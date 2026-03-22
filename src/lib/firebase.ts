import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  connectFirestoreEmulator,
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import type { Order, Product, Host } from './schema';
import { COLLECTIONS } from './schema';

// ─── Firebase 초기화 ──────────────────────────────────────────────────────────
// .env.local 에 아래 변수 설정 필요:
// VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, ...
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Auth 초기화 — API 키가 유효하지 않으면 catch (플레이스홀더 키 사용 시)
let _auth: ReturnType<typeof getAuth>;
try {
  _auth = getAuth(app);
} catch {
  // 플레이스홀더 환경변수일 때 crash 방지 — 로그인 시도 시 에러 표시됨
  _auth = {} as ReturnType<typeof getAuth>;
}
export const auth = _auth;

// 로컬 에뮬레이터 연결 (개발 환경에서만)
if (import.meta.env.DEV) {
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  } catch {
    // 이미 연결된 경우 무시
  }
}

// ─── 주문 ID 생성 ─────────────────────────────────────────────────────────────
export async function generateOrderId(): Promise<string> {
  const snap = await getDocs(collection(db, COLLECTIONS.ORDERS));
  const next = snap.size + 1;
  return `KS-${String(next).padStart(4, '0')}`;
}

// ─── Orders ──────────────────────────────────────────────────────────────────

/** 실시간 주문 구독 (관리자 화면용) */
export function subscribeOrders(
  callback: (orders: Order[]) => void
) {
  const q = query(
    collection(db, COLLECTIONS.ORDERS),
    orderBy('createdAt', 'desc'),
    limit(100)
  );
  return onSnapshot(q, snap => {
    const orders = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: (d.data().createdAt as Timestamp)?.toDate(),
      updatedAt: (d.data().updatedAt as Timestamp)?.toDate(),
      paidAt:    (d.data().paidAt    as Timestamp)?.toDate(),
    })) as Order[];
    callback(orders);
  });
}

/** 주문 상태 업데이트 */
export async function updateOrderStatus(
  orderId: string,
  status: Order['status']
) {
  await updateDoc(doc(db, COLLECTIONS.ORDERS, orderId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

/** 내부 메모 업데이트 */
export async function updateInternalNote(orderId: string, note: string) {
  await updateDoc(doc(db, COLLECTIONS.ORDERS, orderId), {
    internalNote: note,
    updatedAt: serverTimestamp(),
  });
}

/** Stripe 웹훅에서 호출 — 신규 주문 생성 */
export async function createOrder(data: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>) {
  const id = await generateOrderId();
  await addDoc(collection(db, COLLECTIONS.ORDERS), {
    ...data,
    id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return id;
}

// ─── Products ─────────────────────────────────────────────────────────────────

/** 전체 상품 조회 (고객 페이지용) */
export async function getActiveProducts(): Promise<Product[]> {
  const q = query(
    collection(db, COLLECTIONS.PRODUCTS),
    where('active', '==', true),
    orderBy('category')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[];
}

/** 재고 업데이트 (Track A) */
export async function updateStock(productId: string, stock: number) {
  await updateDoc(doc(db, COLLECTIONS.PRODUCTS, productId), {
    stock,
    updatedAt: serverTimestamp(),
  });
}

// ─── Hosts ───────────────────────────────────────────────────────────────────

/** hostId로 숙소 정보 조회 (QR 스캔 시) */
export async function getHost(hostId: string): Promise<Host | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.HOSTS, hostId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Host;
}

/** 전체 호스트 목록 */
export async function getHosts(): Promise<Host[]> {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.HOSTS), where('active', '==', true))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Host[];
}

// ─── 초기 상품 데이터 시드 (최초 1회 실행) ────────────────────────────────────
export const SEED_PRODUCTS: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[] = [
  // Track A — 재고 보유
  { nameKo:'K-스낵 박스', nameEn:'K-Snack Box', nameJa:'Kスナックボックス', nameZh:'韩国零食礼盒',
    category:'bundle', track:'A', priceKrw:35000, costKrw:22000, stock:30, minStock:5,
    imageUrl:'', tags:['hot','editor_pick'], active:true },
  { nameKo:'K-뷰티 스타터 키트', nameEn:'K-Beauty Starter Kit', nameJa:'Kビューティーキット', nameZh:'K美妆入门套装',
    category:'bundle', track:'A', priceKrw:55000, costKrw:35000, stock:20, minStock:5,
    imageUrl:'', tags:['hot'], active:true },
  { nameKo:'라면 챌린지 박스', nameEn:'Ramen Challenge Box', nameJa:'ラーメンチャレンジ', nameZh:'拉面挑战礼盒',
    category:'bundle', track:'A', priceKrw:28000, costKrw:17000, stock:25, minStock:5,
    imageUrl:'', tags:['viral'], active:true },
  { nameKo:'신라면 5개입', nameEn:'Shin Ramen (5-pack)', nameJa:'辛ラーメン5個入', nameZh:'辛拉面5包装',
    category:'ramen', track:'A', priceKrw:7500, costKrw:5000, stock:50, minStock:10,
    imageUrl:'', tags:['editor_pick'], active:true },
  { nameKo:'불닭볶음면', nameEn:'Buldak Ramen', nameJa:'ブルダック炒め麺', nameZh:'火鸡面',
    category:'ramen', track:'A', priceKrw:2500, costKrw:1500, stock:60, minStock:10,
    imageUrl:'', tags:['viral','hot'], active:true },
  { nameKo:'허니버터칩', nameEn:'Honey Butter Chip', nameJa:'ハニーバターチップ', nameZh:'蜂蜜黄油薯片',
    category:'snack', track:'A', priceKrw:2800, costKrw:1800, stock:40, minStock:10,
    imageUrl:'', tags:['hot'], active:true },
  { nameKo:'메디힐 마스크팩 10장', nameEn:'Mediheal Sheet Mask (10p)', nameJa:'メディヒール10枚', nameZh:'美迪惠尔面膜10片',
    category:'beauty', track:'A', priceKrw:15000, costKrw:10000, stock:30, minStock:5,
    imageUrl:'', tags:['hot'], active:true },
  { nameKo:'롬앤 글라스팅 틴트', nameEn:"Rom&nd Glasting Tint", nameJa:'ロムアンドティント', nameZh:'롬앤染唇液',
    category:'beauty', track:'A', priceKrw:14000, costKrw:9000, stock:20, minStock:5,
    imageUrl:'', tags:['editor_pick'], active:true },
  { nameKo:'COSRX 달팽이크림', nameEn:'COSRX Snail Mucin Cream', nameJa:'COSRXカタツムリクリーム', nameZh:'COSRX蜗牛霜',
    category:'beauty', track:'A', priceKrw:30000, costKrw:20000, stock:15, minStock:3,
    imageUrl:'', tags:['editor_pick'], active:true },

  // Track B — 대행 주문
  { nameKo:'정관장 홍삼정 30포', nameEn:'Korean Red Ginseng (30p)', nameJa:'高麗人参エキス', nameZh:'正官庄红参精',
    category:'health', track:'B', priceKrw:55000, costKrw:45000, stock:null, minStock:0,
    imageUrl:'', tags:['hot'], active:true },
  { nameKo:'올리브영 선크림', nameEn:'Olive Young Sunscreen', nameJa:'サンクリーム', nameZh:'防晒霜',
    category:'beauty', track:'B', priceKrw:22000, costKrw:17000, stock:null, minStock:0,
    imageUrl:'', tags:[], active:true },
  { nameKo:'무신사 스탠다드 반팔', nameEn:'Musinsa Standard Tee', nameJa:'Tシャツ', nameZh:'T恤',
    category:'daily', track:'B', priceKrw:35000, costKrw:27000, stock:null, minStock:0,
    imageUrl:'', tags:[], active:true },
];

// ─── Host Portal 전용 ─────────────────────────────────────────────────────────

/** 호스트 계정 생성 (KJ가 Firebase Console 대신 코드로 생성할 때)
 *
 * 사용법:
 *   1. Firebase Console > Authentication > 사용자 추가로 호스트 이메일 계정 생성
 *   2. 생성된 UID를 복사
 *   3. Firestore > hosts > {UID} 문서로 호스트 정보 저장
 *      (문서 ID = Auth UID 이면 HostPortal에서 자동 조회됨)
 */
export async function createHostAccount(uid: string, data: Omit<Host, 'id' | 'joinedAt' | 'totalOrders' | 'totalRewardKrw' | 'settledRewardKrw' | 'pendingRewardKrw'>) {
  await (await import('firebase/firestore')).setDoc(
    (await import('firebase/firestore')).doc(db, 'hosts', uid),
    {
      ...data,
      totalOrders:      0,
      totalRewardKrw:   0,
      settledRewardKrw: 0,
      pendingRewardKrw: 0,
      joinedAt: (await import('firebase/firestore')).serverTimestamp(),
    }
  );
}
