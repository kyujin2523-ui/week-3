/**
 * K-SHOP Firebase Functions
 *
 * createCheckout   POST /createCheckout   — Stripe Checkout Session 생성
 * stripeWebhook    POST /stripeWebhook    — 결제 완료 → Firestore 주문 생성
 * checkoutReminder  매일 오전 9시 KST      — 귀국 D-2 업셀 알림
 * stockMonitor      매시간                 — Track A 재고 감시
 *
 * 배포: cd functions && npm install && firebase deploy --only functions
 */

import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { setGlobalOptions } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ region: 'asia-northeast1' }); // 도쿄 — 한국과 가장 가까운 리전

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' });
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

// ─── Types ────────────────────────────────────────────────────────────────────
interface CheckoutItem {
  productId:    string;
  nameEn:       string;
  nameKo:       string;
  quantity:     number;
  unitPriceKrw: number;
  track:        'A' | 'B';
}

interface CheckoutRequest {
  hostId:       string;
  hostName:     string;
  hostAddress:  string;
  items:        CheckoutItem[];
  guest: {
    name:     string;
    phone:    string;
    note:     string;
    checkin:  string;
    checkout: string;
    language: string;
    country:  string;
  };
  successUrl: string;
  cancelUrl:  string;
}

// ─── 주문 ID 생성 (동시 주문 시 중복 방지용 트랜잭션) ─────────────────────────
async function generateOrderId(): Promise<string> {
  const counterRef = db.doc('_meta/orderCounter');
  const count = await db.runTransaction(async tx => {
    const doc = await tx.get(counterRef);
    const next = (doc.exists ? (doc.data()!.count as number) : 0) + 1;
    tx.set(counterRef, { count: next });
    return next;
  });
  return `KS-${String(count).padStart(4, '0')}`;
}

// ─── KJ Slack 알림 ────────────────────────────────────────────────────────────
async function notifyKJ(text: string) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) { console.log('[KJ 알림]', text); return; }
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  }).catch(e => console.error('Slack 알림 실패:', e));
}

// ─── 1. createCheckout ────────────────────────────────────────────────────────
// 클라이언트 → 이 함수 호출 → Stripe Session 생성 → 리다이렉트 URL 반환
export const createCheckout = onRequest(
  { cors: ['https://kshop.kr', 'http://localhost:5173'] },
  async (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method not allowed'); return; }

    const body = req.body as CheckoutRequest;
    if (!body.hostId || !body.items?.length || !body.guest?.name || !body.guest?.phone) {
      res.status(400).json({ error: 'Missing required fields' }); return;
    }

    // Stripe Line Items — KRW는 unit_amount = 원 단위 그대로 (최소 단위 없음)
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = body.items.map(item => ({
      price_data: {
        currency: 'krw',
        unit_amount: item.unitPriceKrw,
        product_data: {
          name: item.nameEn,
          description: `${item.nameKo} · Track-${item.track}`,
        },
      },
      quantity: item.quantity,
    }));

    // 웹훅에서 주문 재구성에 필요한 모든 정보를 메타데이터에 저장
    const metadata: Record<string, string> = {
      hostId:        body.hostId,
      hostName:      body.hostName,
      hostAddress:   body.hostAddress,
      guestName:     body.guest.name,
      guestPhone:    body.guest.phone,
      guestNote:     body.guest.note     ?? '',
      guestCheckin:  body.guest.checkin  ?? '',
      guestCheckout: body.guest.checkout ?? '',
      guestLanguage: body.guest.language ?? 'en',
      guestCountry:  body.guest.country  ?? '',
      items: JSON.stringify(body.items), // 2KB 이하 유지
    };

    try {
      const session = await stripe.checkout.sessions.create({
        mode:       'payment',
        line_items: lineItems,
        metadata,
        success_url: `${body.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:   body.cancelUrl,
        payment_method_types: ['card'],
        locale: ({ ja:'ja', 'zh-cn':'zh', 'zh-tw':'zh-TW' } as Record<string,any>)[body.guest.language] ?? 'en',
      });

      res.json({ sessionId: session.id, url: session.url });
    } catch (e: any) {
      console.error('Stripe session 생성 실패:', e);
      res.status(500).json({ error: e.message });
    }
  }
);

// ─── 2. stripeWebhook ─────────────────────────────────────────────────────────
// Stripe → 이 함수 호출 → Firestore 주문 생성 + 호스트 리워드 누적 + KJ 알림
export const stripeWebhook = onRequest(
  { cors: false, rawBody: true },
  async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, WEBHOOK_SECRET);
    } catch {
      res.status(400).send('Webhook signature invalid'); return;
    }

    if (event.type !== 'checkout.session.completed') {
      res.json({ received: true }); return;
    }

    const session  = event.data.object as Stripe.Checkout.Session;
    const meta     = session.metadata!;
    const items    = JSON.parse(meta.items ?? '[]') as CheckoutItem[];
    const totalKrw = session.amount_total!; // KRW 원 단위

    const trackSummary =
      items.every(i => i.track === 'A') ? 'A' :
      items.every(i => i.track === 'B') ? 'B' : 'mixed';

    const orderId = await generateOrderId();

    // Firestore 주문 문서 생성
    await db.collection('orders').add({
      id:           orderId,
      hostId:       meta.hostId,
      hostName:     meta.hostName,
      hostAddress:  meta.hostAddress,
      guestName:    meta.guestName,
      guestPhone:   meta.guestPhone,
      guestCountry: meta.guestCountry,
      guestLanguage:meta.guestLanguage,
      checkinDate:  meta.guestCheckin,
      checkoutDate: meta.guestCheckout,
      items,
      totalKrw,
      rewardKrw:   Math.round(totalKrw * 0.05),
      marginKrw:   Math.round(totalKrw * 0.20),
      status:      'new',
      trackSummary,
      note:        meta.guestNote ?? '',
      internalNote:'',
      stripePaymentId: session.payment_intent as string,
      stripeSessionId: session.id,
      paidAt:    admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 호스트 리워드 누적
    const reward = Math.round(totalKrw * 0.05);
    await db.doc(`hosts/${meta.hostId}`).update({
      totalOrders:      admin.firestore.FieldValue.increment(1),
      totalRewardKrw:   admin.firestore.FieldValue.increment(reward),
      pendingRewardKrw: admin.firestore.FieldValue.increment(reward),
    });

    // KJ 알림
    await notifyKJ(
      `🛍 신규 주문 ${orderId}\n` +
      `• 고객: ${meta.guestName} (${meta.guestCountry})\n` +
      `• 금액: ₩${totalKrw.toLocaleString()}\n` +
      `• 트랙: ${trackSummary} | 숙소: ${meta.hostName}`
    );

    res.json({ received: true, orderId });
  }
);

// ─── 3. checkoutReminder — 귀국 D-2 업셀 (매일 KST 09:00) ───────────────────
export const checkoutReminder = onSchedule(
  { schedule: '0 0 * * *', timeZone: 'Asia/Seoul' },
  async () => {
    const d2 = new Date();
    d2.setDate(d2.getDate() + 2);
    const targetDate = d2.toISOString().split('T')[0];

    const MSG: Record<string, string> = {
      en:      '🛍️ 2 days until checkout! Last chance to order Korean snacks & beauty. K-SHOP',
      ja:      '🛍️ チェックアウトまであと2日！韓国のお土産をご注文ください。K-SHOP',
      'zh-cn': '🛍️ 距离退房还有2天！快来订购韩国零食和美妆带回家！K-SHOP',
      'zh-tw': '🛍️ 退房還有2天！快訂購韓國零食和美妝帶回家！K-SHOP',
    };

    const snap = await db.collection('orders')
      .where('checkoutDate', '==', targetDate)
      .where('status', 'in', ['processing', 'shipped', 'done'])
      .get();

    for (const doc of snap.docs) {
      const order = doc.data();
      const msg = MSG[order.guestLanguage] ?? MSG['en'];
      // Twilio 연동 시 아래 주석 해제
      // await twilioClient.messages.create({
      //   body: msg, to: order.guestPhone, from: process.env.TWILIO_FROM,
      // });
      console.log(`[D-2] → ${order.guestPhone}: ${msg}`);
    }
    console.log(`[D-2 알림] ${snap.size}건 처리 (${targetDate})`);
  }
);

// ─── 4. stockMonitor — Track A 재고 감시 (매시간) ────────────────────────────
export const stockMonitor = onSchedule(
  { schedule: '0 * * * *', timeZone: 'Asia/Seoul' },
  async () => {
    const snap = await db.collection('products')
      .where('track', '==', 'A')
      .where('active', '==', true)
      .get();

    const low: string[] = [];
    for (const doc of snap.docs) {
      const p = doc.data();
      if (p.stock !== null && p.stock <= p.minStock) {
        low.push(`${p.nameKo} (현재 ${p.stock}개, 최소 ${p.minStock}개)`);
      }
    }
    if (low.length) {
      await notifyKJ(`⚠️ 재고 부족\n${low.map(s => `• ${s}`).join('\n')}`);
    }
  }
);
