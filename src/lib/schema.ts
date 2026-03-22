/**
 * K-SHOP Firebase Firestore Schema
 * 
 * Collections:
 *   /products/{productId}
 *   /hosts/{hostId}
 *   /orders/{orderId}
 *   /settlements/{settlementId}
 */

// ─── Product ────────────────────────────────────────────────────────────────
export type TrackType = 'A' | 'B';

export type ProductCategory =
  | 'snack'
  | 'ramen'
  | 'beauty'
  | 'health'
  | 'daily'
  | 'bundle';

export interface Product {
  id: string;
  nameKo: string;           // 한국어 상품명
  nameEn: string;           // 영어 상품명
  nameJa: string;           // 일본어 상품명
  nameZh: string;           // 중국어 상품명
  category: ProductCategory;
  track: TrackType;
  priceKrw: number;         // 고객 판매가 (수수료 포함)
  costKrw: number;          // 실제 쿠팡 구매가
  stock: number | null;     // Track A만 사용, B는 null
  minStock: number;         // Track A 재주문 알림 임계값
  imageUrl: string;
  tags: string[];           // 'hot' | 'new' | 'editor_pick' | 'viral'
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Host ────────────────────────────────────────────────────────────────────
export interface Host {
  id: string;
  name: string;             // 숙소 이름
  ownerName: string;        // 호스트 이름
  phone: string;
  address: string;          // 숙소 주소 (QR 스캔 시 자동 등록)
  addressDetail: string;
  active: boolean;
  rewardRate: number;       // 기본 0.05 (5%)
  totalOrders: number;
  totalRewardKrw: number;
  settledRewardKrw: number;
  pendingRewardKrw: number;
  joinedAt: Date;
}

// ─── Order ────────────────────────────────────────────────────────────────────
export type OrderStatus =
  | 'new'         // 신규 — 결제 완료, 처리 전
  | 'processing'  // 처리중 — KJ가 확인, 구매 진행
  | 'shipped'     // 배송중 — 쿠팡 발송 완료
  | 'done'        // 완료 — 게스트 수령
  | 'cancelled';  // 취소 — 환불 완료

export interface OrderItem {
  productId: string;
  nameEn: string;
  nameKo: string;
  quantity: number;
  unitPriceKrw: number;
  track: TrackType;
}

export interface Order {
  id: string;               // KS-XXXX 형식
  hostId: string;
  hostName: string;
  hostAddress: string;

  // 고객 정보
  guestName: string;
  guestPhone: string;       // WhatsApp or 카카오
  guestCountry: string;     // ISO 3166-1 alpha-2
  guestLanguage: 'en' | 'ja' | 'zh-cn' | 'zh-tw';
  checkinDate: string;      // YYYY-MM-DD
  checkoutDate: string;

  // 주문 내용
  items: OrderItem[];
  totalKrw: number;         // 전체 결제금액
  rewardKrw: number;        // 호스트 리워드 (totalKrw * 5%)
  marginKrw: number;        // 예상 마진

  // 처리 정보
  status: OrderStatus;
  trackSummary: TrackType | 'mixed'; // A / B / mixed
  note: string;             // 고객 메모
  internalNote: string;     // KJ 내부 메모

  // Stripe
  stripePaymentId: string;
  paidAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

// ─── Settlement ───────────────────────────────────────────────────────────────
export interface Settlement {
  id: string;
  hostId: string;
  hostName: string;
  periodStart: Date;
  periodEnd: Date;
  orderCount: number;
  totalOrderAmountKrw: number;
  rewardKrw: number;
  status: 'pending' | 'paid';
  paidAt: Date | null;
  createdAt: Date;
}

// ─── Firestore 경로 상수 ──────────────────────────────────────────────────────
export const COLLECTIONS = {
  PRODUCTS:    'products',
  HOSTS:       'hosts',
  ORDERS:      'orders',
  SETTLEMENTS: 'settlements',
} as const;
