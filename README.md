# K-SHOP 프로젝트 구조

```
kshop/
├── src/
│   ├── lib/
│   │   ├── schema.ts          ← Firestore 타입 정의 + 컬렉션 경로
│   │   └── firebase.ts        ← Firebase 초기화 + DB 헬퍼 함수
│   ├── pages/
│   │   ├── AdminDashboard.tsx ← 관리자 화면 (현재 완성)
│   │   ├── OrderPage.tsx      ← 고객 주문 화면 (다음)
│   │   └── HostPortal.tsx     ← 호스트 대시보드 (그 다음)
│   ├── components/            ← 공용 컴포넌트
│   └── functions/
│       └── index.ts           ← Firebase Functions (Stripe 웹훅 등)
├── .env.local                 ← Firebase 키 (git 제외)
├── firebase.json
├── firestore.rules
└── vite.config.ts
```

---

## 시작 순서

### Step 1 — 환경 세팅 (1회)

```bash
# SeoulTourMap 프로젝트에 파일 추가하거나, 새 Vite 프로젝트 생성
npm create vite@latest kshop -- --template react-ts
cd kshop
npm install firebase stripe @stripe/stripe-js
npm install -D @types/node
```

### Step 2 — .env.local 생성

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Step 3 — Firebase 콘솔에서 할 일

1. Firestore Database 생성 (테스트 모드로 시작)
2. Authentication 활성화 (이메일/비밀번호)
3. 아래 컬렉션 수동 생성 후 초기 데이터 입력:
   - `products` — schema.ts의 SEED_PRODUCTS 참고
   - `hosts`    — 지인 호스트 1개 먼저 추가

### Step 4 — 첫 호스트 데이터 예시

```json
// Firestore > hosts > {자동ID}
{
  "name": "지인 호스트 테스트 숙소",
  "ownerName": "홍길동",
  "phone": "010-0000-0000",
  "address": "서울 종로구 삼청로 14-5",
  "addressDetail": "301호",
  "active": true,
  "rewardRate": 0.05,
  "totalOrders": 0,
  "totalRewardKrw": 0,
  "settledRewardKrw": 0,
  "pendingRewardKrw": 0,
  "joinedAt": "현재 날짜"
}
```

문서 ID를 복사해두면 QR URL에 사용됨:
`https://kshop.kr/order?host={문서ID}`

### Step 5 — 관리자 로그인

Firebase Console > Authentication > 사용자 추가
→ KJ 이메일 + 비밀번호 등록
→ AdminDashboard에서 Firebase Auth 로그인 래퍼 추가 (다음 단계)

---

## 다음 개발 순서

| 순서 | 파일 | 내용 |
|------|------|------|
| ✅ 완료 | schema.ts | DB 타입 정의 |
| ✅ 완료 | firebase.ts | DB 헬퍼 함수 |
| ✅ 완료 | AdminDashboard.tsx | 관리자 주문 화면 |
| ✅ 완료 | functions/index.ts | Stripe 웹훅 + 스케줄러 |
| 다음 | OrderPage.tsx | 고객 QR 주문 화면 |
| 그 다음 | Auth 래퍼 | 관리자 로그인 보호 |
| 그 다음 | HostPortal.tsx | 호스트 대시보드 |
| Phase 2 | Stripe 연동 | 실제 결제 흐름 |
