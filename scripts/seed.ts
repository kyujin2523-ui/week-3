/**
 * K-SHOP 초기 데이터 시드 스크립트
 *
 * 실행 방법:
 *   npx ts-node --esm scripts/seed.ts
 *   또는
 *   node --loader ts-node/esm scripts/seed.ts
 *
 * 에뮬레이터가 실행 중이어야 합니다:
 *   firebase emulators:start --only firestore,auth
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  connectFirestoreEmulator,
  collection,
  doc,
  setDoc,
  addDoc,
  Timestamp,
} from 'firebase/firestore';
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
} from 'firebase/auth';

// 에뮬레이터 연결 (실제 Firebase 프로젝트 ID는 아무거나 가능)
const app  = initializeApp({ projectId: 'demo-kshop', apiKey: 'AIzaSyDemoKeyForLocalEmulatorOnly000', authDomain: 'demo-kshop.firebaseapp.com' });
const db   = getFirestore(app);
const auth = getAuth(app);

connectFirestoreEmulator(db,   'localhost', 8080);
connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });

// ─── 계정 생성 헬퍼 ───────────────────────────────────────────────────────────
async function createUser(email: string, password: string): Promise<string> {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    return cred.user.uid;
  } catch (e: any) {
    if (e.code === 'auth/email-already-in-use') {
      console.log(`  ↳ 이미 존재: ${email}`);
      // 에뮬레이터에서 기존 uid 조회는 복잡하므로 재생성
      return 'existing-uid';
    }
    throw e;
  }
}

async function seed() {
  console.log('🌱 K-SHOP 시드 데이터 생성 시작\n');

  // ─── 1. 관리자 계정 ─────────────────────────────────────────────────────────
  console.log('① 관리자 계정 생성');
  const adminUid = await createUser('admin@kshop.kr', 'admin1234!');
  console.log(`  ✓ admin@kshop.kr (uid: ${adminUid})\n`);

  // ─── 2. 호스트 계정 + Firestore 문서 ─────────────────────────────────────────
  console.log('② 테스트 호스트 생성');
  const hostUid = await createUser('host@test.com', 'host1234!');

  await setDoc(doc(db, 'hosts', hostUid), {
    name:             '지인 숙소 — 홍대 스튜디오 101',
    ownerName:        '홍길동',
    phone:            '010-1234-5678',
    address:          '서울 마포구 와우산로 123',
    addressDetail:    '101호',
    active:           true,
    rewardRate:       0.05,
    totalOrders:      3,
    totalRewardKrw:   7400,
    settledRewardKrw: 0,
    pendingRewardKrw: 7400,
    joinedAt:         Timestamp.now(),
  });
  console.log(`  ✓ host@test.com (uid: ${hostUid}, hostId: ${hostUid})\n`);

  // ─── 3. 상품 데이터 ────────────────────────────────────────────────────────
  console.log('③ 상품 15개 생성');
  const products = [
    // Track A
    { nameKo:'K-스낵 박스',         nameEn:'K-Snack Box',            nameJa:'Kスナックボックス',    nameZh:'韩国零食礼盒',   category:'bundle', track:'A', priceKrw:35000, costKrw:22000, stock:30, minStock:5,  tags:['hot','editor_pick'], active:true },
    { nameKo:'K-뷰티 스타터 키트',   nameEn:'K-Beauty Starter Kit',   nameJa:'Kビューティーキット', nameZh:'K美妆入门套装',  category:'bundle', track:'A', priceKrw:55000, costKrw:35000, stock:20, minStock:5,  tags:['hot'],              active:true },
    { nameKo:'라면 챌린지 박스',     nameEn:'Ramen Challenge Box',    nameJa:'ラーメンチャレンジ',  nameZh:'拉面挑战礼盒',   category:'bundle', track:'A', priceKrw:28000, costKrw:17000, stock:25, minStock:5,  tags:['viral'],            active:true },
    { nameKo:'신라면 5개입',         nameEn:'Shin Ramen (5-pack)',    nameJa:'辛ラーメン5個',       nameZh:'辛拉面5包',      category:'ramen',  track:'A', priceKrw:7500,  costKrw:5000,  stock:50, minStock:10, tags:['editor_pick'],      active:true },
    { nameKo:'불닭볶음면',           nameEn:'Buldak Ramen',           nameJa:'ブルダック炒め麺',    nameZh:'火鸡面',         category:'ramen',  track:'A', priceKrw:2500,  costKrw:1500,  stock:60, minStock:10, tags:['viral','hot'],      active:true },
    { nameKo:'불닭 카보나라',        nameEn:'Buldak Carbonara',       nameJa:'カルボナーラ味',      nameZh:'卡波纳拉味',     category:'ramen',  track:'A', priceKrw:2500,  costKrw:1500,  stock:40, minStock:10, tags:['new'],              active:true },
    { nameKo:'허니버터칩',           nameEn:'Honey Butter Chip',      nameJa:'ハニーバターチップ',  nameZh:'蜂蜜黄油薯片',   category:'snack',  track:'A', priceKrw:2800,  costKrw:1800,  stock:40, minStock:10, tags:['hot'],              active:true },
    { nameKo:'새우깡',               nameEn:'Shrimp Crackers',        nameJa:'えびせん',            nameZh:'虾条',           category:'snack',  track:'A', priceKrw:1800,  costKrw:1200,  stock:50, minStock:10, tags:['editor_pick'],      active:true },
    { nameKo:'메디힐 마스크팩 10장', nameEn:'Mediheal Sheet Mask 10p',nameJa:'メディヒール10枚',   nameZh:'美迪惠尔面膜10片',category:'beauty', track:'A', priceKrw:15000, costKrw:10000, stock:30, minStock:5,  tags:['hot'],              active:true },
    { nameKo:'롬앤 글라스팅 틴트',   nameEn:"Rom&nd Glasting Tint",   nameJa:'ロムアンドティント', nameZh:'롬앤染唇液',     category:'beauty', track:'A', priceKrw:14000, costKrw:9000,  stock:20, minStock:5,  tags:['editor_pick'],      active:true },
    { nameKo:'COSRX 달팽이크림',     nameEn:'COSRX Snail Mucin',      nameJa:'COSRXカタツムリ',    nameZh:'COSRX蜗牛霜',   category:'beauty', track:'A', priceKrw:30000, costKrw:20000, stock:15, minStock:3,  tags:['editor_pick'],      active:true },
    // Track B
    { nameKo:'정관장 홍삼정 30포',   nameEn:'Red Ginseng (30p)',      nameJa:'高麗人参エキス',      nameZh:'正官庄红参精',   category:'health', track:'B', priceKrw:55000, costKrw:45000, stock:null, minStock:0, tags:['hot'],            active:true },
    { nameKo:'올리브영 선크림',       nameEn:'Olive Young Sunscreen',  nameJa:'サンクリーム',        nameZh:'防晒霜',         category:'beauty', track:'B', priceKrw:22000, costKrw:17000, stock:null, minStock:0, tags:[],                 active:true },
    { nameKo:'무신사 스탠다드 반팔', nameEn:'Musinsa Standard Tee',   nameJa:'Tシャツ',             nameZh:'T恤',            category:'daily',  track:'B', priceKrw:35000, costKrw:27000, stock:null, minStock:0, tags:[],                 active:true },
    { nameKo:'비타500',              nameEn:'Vita 500 Vitamin C',     nameJa:'ビタミンC飲料',       nameZh:'维他命C',        category:'health', track:'A', priceKrw:1500,  costKrw:800,   stock:60, minStock:10, tags:['new'],              active:true },
  ];

  for (const p of products) {
    await addDoc(collection(db, 'products'), { ...p, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    process.stdout.write('.');
  }
  console.log(`\n  ✓ ${products.length}개 생성\n`);

  // ─── 4. 테스트 주문 3건 ────────────────────────────────────────────────────
  console.log('④ 테스트 주문 3건 생성');
  const testOrders = [
    {
      id: 'KS-0001', hostId: hostUid, hostName: '지인 숙소 — 홍대 스튜디오 101',
      hostAddress: '서울 마포구 와우산로 123 101호',
      guestName: 'Emma Rodriguez', guestPhone: '+1-555-0001',
      guestCountry: 'US', guestLanguage: 'en',
      checkinDate: '2025-03-14', checkoutDate: '2025-03-18',
      items: [
        { productId: 'p1', nameEn:'K-Snack Box', nameKo:'K-스낵 박스', quantity:1, unitPriceKrw:35000, track:'A' },
        { productId: 'p9', nameEn:'Mediheal Sheet Mask', nameKo:'메디힐 마스크팩', quantity:1, unitPriceKrw:15000, track:'A' },
      ],
      totalKrw: 50000, rewardKrw: 2500, marginKrw: 10000,
      status: 'new', trackSummary: 'A',
      note: '허니버터칩 꼭 넣어주세요!', internalNote: '',
      stripePaymentId: 'pi_test_001', stripeSessionId: 'cs_test_001',
    },
    {
      id: 'KS-0002', hostId: hostUid, hostName: '지인 숙소 — 홍대 스튜디오 101',
      hostAddress: '서울 마포구 와우산로 123 101호',
      guestName: 'Yuki Tanaka', guestPhone: '+81-90-1234-5678',
      guestCountry: 'JP', guestLanguage: 'ja',
      checkinDate: '2025-03-13', checkoutDate: '2025-03-17',
      items: [
        { productId: 'p10', nameEn:"Rom&nd Tint", nameKo:'롬앤 틴트', quantity:2, unitPriceKrw:14000, track:'A' },
        { productId: 'p4',  nameEn:'Shin Ramen',  nameKo:'신라면 5개입', quantity:1, unitPriceKrw:7500, track:'A' },
      ],
      totalKrw: 35500, rewardKrw: 1775, marginKrw: 7100,
      status: 'processing', trackSummary: 'A',
      note: '', internalNote: '롬앤 #20, #21 각 1개씩',
      stripePaymentId: 'pi_test_002', stripeSessionId: 'cs_test_002',
    },
    {
      id: 'KS-0003', hostId: hostUid, hostName: '지인 숙소 — 홍대 스튜디오 101',
      hostAddress: '서울 마포구 와우산로 123 101호',
      guestName: 'Chen Wei', guestPhone: '+86-138-0000-0001',
      guestCountry: 'CN', guestLanguage: 'zh-cn',
      checkinDate: '2025-03-12', checkoutDate: '2025-03-16',
      items: [
        { productId: 'p12', nameEn:'Red Ginseng', nameKo:'정관장 홍삼정', quantity:1, unitPriceKrw:55000, track:'B' },
      ],
      totalKrw: 55000, rewardKrw: 2750, marginKrw: 11000,
      status: 'done', trackSummary: 'B',
      note: '', internalNote: '',
      stripePaymentId: 'pi_test_003', stripeSessionId: 'cs_test_003',
    },
  ];

  for (const order of testOrders) {
    await addDoc(collection(db, 'orders'), {
      ...order,
      paidAt:    Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    console.log(`  ✓ ${order.id} — ${order.guestName} (${order.status})`);
  }

  // ─── 완료 ─────────────────────────────────────────────────────────────────
  console.log('\n✅ 시드 완료!\n');
  console.log('테스트 계정:');
  console.log(`  관리자: admin@kshop.kr / admin1234!`);
  console.log(`  호스트: host@test.com  / host1234!`);
  console.log(`  hostId: ${hostUid}`);
  console.log(`\n고객 주문 URL: http://localhost:5173/?host=${hostUid}`);
  console.log(`호스트 포털: http://localhost:5173/host`);
  console.log(`관리자:      http://localhost:5173/\n`);

  process.exit(0);
}

seed().catch(e => { console.error('❌ 시드 실패:', e); process.exit(1); });
