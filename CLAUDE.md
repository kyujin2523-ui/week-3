# K-SHOP — Claude Code 핸드오프

> 이 파일은 Claude Code가 프로젝트 컨텍스트를 자동으로 읽기 위한 파일입니다.
> `claude` 명령 실행 시 자동으로 로드됩니다.

---

## 프로젝트 개요

**K-SHOP**: 한국 방문 외국인 여행자를 위한 쇼핑 대행 서비스.
숙소에 비치된 QR 코드를 스캔하면 한국어·결제수단 없이도 스낵·K-뷰티·라면 등을 주문하고 숙소로 배달받을 수 있다.

### 비즈니스 모델
- **B2B2C**: 쇼핑몰(K-SHOP) ↔ 숙소 호스트(파트너) ↔ 외국인 게스트(고객)
- 호스트는 QR 비치만 하면 주문금액의 **5% 리워드** 수령
- 수익: 쿠팡 구매가 대비 **30~35% 마크업** → 리워드(5%) + Stripe(3.4%) 차감 후 순마진 **약 20~24%**
- Track A: 재고 직접 보유 → 쿠팡 Wing API 자동 발주 (마진 25~28%)
- Track B: 주문 접수 후 쿠팡/올리브영 수동 구매 대행 (마진 14~18%)

### 1차 타깃
- 지인 에어비앤비 호스트 (방 2개, 월 예약 8~9건/방, 중화권·일본인 많음)
- 월 예상 순수익: 비관 ₩33,000 / 현실 ₩100,000 / 낙관 ₩213,000

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 프론트엔드 | React 18 + TypeScript + Vite |
| 스타일링 | CSS-in-JS (inline styles), Geist 폰트 |
| DB | Firebase Firestore |
| 인증 | Firebase Auth (이메일/비밀번호) |
| 백엔드 | Firebase Functions v2 (Node 20) |
| 결제 | Stripe Checkout (KRW, 해외카드) |
| 배포 | Cloudflare Pages (프론트) + Firebase (백) |
| 알림 | Twilio SMS (미구현) / 카카오 알림톡 (미구현) |

---

## 디자인 룰 (절대 변경 금지)

> **Notion + 애플 방향. AI 생성 느낌 제거.**

1. **라이트 테마만** — 다크 테마 없음
2. **색 2개만** — accent `#0066cc`, danger `#cc3300`. 나머지는 회색 톤
3. **이모지 아이콘 금지** — 텍스트 레이블로만
4. **상태 표시 = 점(dot) + 텍스트** — 색 배지 없음
5. **폰트 1개** — Geist. Mono는 금액·주문번호에만
6. **버튼 3종** — Primary(검정), Secondary(테두리), Ghost(텍스트만)
7. **그림자 없음, 카드 남발 금지** — border-radius 최대 8px

```
색상 토큰:
--bg:      #ffffff   --bg2: #f7f7f5   --bg3: #f0f0ec
--border:  #e8e8e4   --bd2: #d4d4ce
--text:    #1a1a1a   --t2:  #6b6b6b   --t3:  #b0b0a8
--accent:  #0066cc   --danger: #cc3300
```

---

## 파일 구조

```
kshop/
├── CLAUDE.md                    ← 이 파일 (Claude Code 컨텍스트)
├── index.html                   ← Vite 진입점
├── package.json
├── vite.config.ts
├── tsconfig.json
├── firebase.json                ← 에뮬레이터 설정
├── firestore.rules              ← 보안 규칙
├── firestore.indexes.json
├── functions-package.json       ← functions/ 폴더용 package.json
├── .env.local.example           ← 환경변수 템플릿
├── LOCAL_TEST_GUIDE.md          ← 로컬 테스트 단계별 가이드
│
├── scripts/
│   └── seed.ts                  ← 에뮬레이터 초기 데이터 생성
│
└── src/
    ├── main.tsx                 ← React 진입점
    ├── App.tsx                  ← 라우터 (URL 파라미터 기반)
    │
    ├── lib/
    │   ├── schema.ts            ← Firestore 타입 정의 + 컬렉션 상수
    │   ├── firebase.ts          ← Firebase 초기화 + DB 헬퍼 + 에뮬레이터 연결
    │   └── i18n.ts              ← 4개 언어 (EN/JA/ZH-CN/ZH-TW) 텍스트
    │
    ├── pages/
    │   ├── AdminDashboard.tsx   ← KJ 관리자 화면 (주문·상태·상세패널)
    │   ├── OrderPage.tsx        ← 고객 QR 주문 화면 (카탈로그·장바구니·결제)
    │   ├── HostPortal.tsx       ← 호스트 전용 포털 (주문현황·QR·리워드)
    │   ├── LoginPage.tsx        ← 관리자 로그인
    │   └── SuccessPage.tsx      ← 결제 완료 페이지
    │
    └── functions/
        └── index.ts             ← Firebase Functions
                                    - createCheckout: Stripe 세션 생성
                                    - stripeWebhook: 결제 완료 → 주문 생성
                                    - checkoutReminder: D-2 귀국 업셀 (매일 9시)
                                    - stockMonitor: Track A 재고 감시 (매시간)
```

---

## URL 라우팅

| URL | 페이지 | 인증 |
|-----|--------|------|
| `/` | 관리자 대시보드 | Firebase Auth 필요 |
| `/?host={hostId}` | 고객 QR 주문 페이지 | 없음 |
| `/?host={hostId}&status=success` | 결제 완료 페이지 | 없음 |
| `/host` | 호스트 포털 | Firebase Auth 필요 |

---

## Firestore 컬렉션 구조

```
products/{productId}
  nameKo, nameEn, nameJa, nameZh
  category: 'snack'|'ramen'|'beauty'|'health'|'daily'|'bundle'
  track: 'A'|'B'
  priceKrw (판매가), costKrw (쿠팡 구매가)
  stock (Track A만), minStock, tags[], active

hosts/{hostId}           ← 문서 ID = Firebase Auth UID
  name, ownerName, phone, address, addressDetail
  rewardRate: 0.05
  totalOrders, totalRewardKrw, settledRewardKrw, pendingRewardKrw

orders/{orderId}
  id: 'KS-XXXX'
  hostId, hostName, hostAddress
  guestName, guestPhone, guestCountry, guestLanguage
  checkinDate, checkoutDate
  items[]: {productId, nameKo, nameEn, quantity, unitPriceKrw, track}
  totalKrw, rewardKrw, marginKrw
  status: 'new'|'processing'|'shipped'|'done'|'cancelled'
  trackSummary: 'A'|'B'|'mixed'
  note, internalNote
  stripePaymentId, stripeSessionId

settlements/{id}
  hostId, periodStart, periodEnd
  orderCount, totalOrderAmountKrw, rewardKrw
  status: 'pending'|'paid'

_meta/orderCounter       ← 주문 ID 채번용 (트랜잭션)
```

---

## 환경변수 (.env.local)

```bash
# Firebase
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# Stripe 프론트엔드
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Firebase Function URL
# 로컬: http://localhost:5001/{projectId}/asia-northeast1/createCheckout
# 배포: https://asia-northeast1-{projectId}.cloudfunctions.net/createCheckout
VITE_FUNCTION_URL=http://localhost:5001/PROJECT_ID/asia-northeast1/createCheckout
```

```bash
# functions/.env (서버 전용 — git 제외)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
SLACK_WEBHOOK_URL=https://hooks.slack.com/...  # KJ 알림용
```

---

## 현재 완성된 것 vs 미구현

### ✅ 완성
- [x] Firestore 스키마 + 타입 정의 (`schema.ts`)
- [x] Firebase 초기화 + 에뮬레이터 연결 (`firebase.ts`)
- [x] 4개 언어 i18n (`i18n.ts`)
- [x] 관리자 대시보드 (`AdminDashboard.tsx`) — 주문 목록, 필터, 상세 패널, 상태 진행
- [x] 고객 주문 페이지 (`OrderPage.tsx`) — 카탈로그, 장바구니, 2단계 결제
- [x] 호스트 포털 (`HostPortal.tsx`) — 주문 내역, QR 생성, 리워드 현황
- [x] 결제 완료 페이지 (`SuccessPage.tsx`)
- [x] Firebase Functions — Stripe 웹훅, D-2 업셀, 재고 감시
- [x] 시드 스크립트 (`scripts/seed.ts`)
- [x] 에뮬레이터 설정 (`firebase.json`)
- [x] Firestore 보안 규칙 (`firestore.rules`)

### ❌ 미구현 (다음 작업)
- [ ] **Firebase 실제 연결 + 로컬 테스트** ← 현재 단계
- [ ] Stripe 실제 결제 테스트 (테스트 카드: `4242 4242 4242 4242`)
- [ ] Twilio SMS 연동 (고객 알림: 주문확인·배송시작·완료·D-2 업셀)
- [ ] 관리자 화면 — 상품 관리 페이지 (CRUD)
- [ ] 관리자 화면 — 호스트 관리 페이지 (등록·QR 발급)
- [ ] 관리자 화면 — 정산 관리 페이지
- [ ] 쿠팡 Wing API 연동 (Track A 자동 발주) — Phase 2
- [ ] Cloudflare Pages 프로덕션 배포
- [ ] 상품 이미지 (현재 이모지 placeholder)
- [ ] `firestore.rules` — `isAdmin()` Custom Claims 설정

---

## 로컬 실행 방법

```bash
# 터미널 1: Firebase 에뮬레이터
firebase emulators:start --import=./emulator-data --export-on-exit=./emulator-data

# 터미널 2: 시드 데이터 (최초 1회)
npx ts-node --esm scripts/seed.ts
# → 관리자: admin@kshop.kr / admin1234!
# → 호스트: host@test.com / host1234!
# → hostId 출력됨 (고객 URL에 사용)

# 터미널 3: 프론트엔드
npm run dev

# 터미널 4: Stripe 웹훅 (결제 테스트 시)
stripe listen --forward-to localhost:5001/{projectId}/asia-northeast1/stripeWebhook
```

접속:
- 관리자: http://localhost:5173/
- 고객: http://localhost:5173/?host={hostId}
- 호스트: http://localhost:5173/host
- 에뮬레이터 UI: http://localhost:4000

---

## 주요 설계 결정 및 이유

1. **단일 페이지 파일, hostId 파라미터로 다중 숙소 지원**
   - 숙소 100개여도 코드 1개. `?host=abc123` URL이 담긴 QR만 숙소마다 발급.

2. **Track A/B 하이브리드 라우팅**
   - 재고 있으면 자동(A), 없으면 수동 대행(B). 고객은 구분 못 함.
   - 라우팅 로직: `src/functions/index.ts` stripeWebhook 참조.

3. **호스트 문서 ID = Firebase Auth UID**
   - 별도 매핑 테이블 없이 `hosts/{user.uid}` 로 직접 조회.

4. **주문 ID 트랜잭션 채번**
   - `_meta/orderCounter` 문서를 트랜잭션으로 증가 → 동시 주문 시 중복 방지.

5. **KRW Stripe 처리**
   - KRW는 최소 단위가 1원 (cents 없음). `unit_amount = 원 단위 그대로`.

6. **에뮬레이터 중복 연결 방지**
   - `firebase.ts`에서 `try/catch`로 이미 연결된 경우 무시.

---

## 비즈니스 컨텍스트 (Claude Code가 알아야 할 것)

- **운영자**: KJ (EPC 엔지니어, 부업으로 진행, 주중 저녁 + 주말)
- **1차 파트너**: 지인 에어비앤비 호스트 (방 2개, 홍대 근처 추정)
- **주요 고객**: 중화권(중국·대만) 40~50%, 일본 20~30%, 기타 유럽·동남아
- **경쟁사 참고**: Korea Order (배달 대행, 운영시간 10:00~12:30, 호스트 포털 미완성)
- **목표**: 지인 숙소 2개로 검증 → 호스트 5곳 → 20곳 확장
- **단기 수익 목표**: 현실 시나리오 기준 월 ₩10만원 (숙소 2개)

---

## 다음에 할 일 (우선순위 순)

1. `npm install` + Firebase 콘솔 프로젝트 생성
2. `.env.local` 환경변수 입력
3. `firebase login` + `firebase use --add`
4. 에뮬레이터 시작 + seed 실행
5. 로컬 3개 화면 테스트 (관리자·고객·호스트)
6. Stripe 테스트 카드로 실제 결제 플로우 확인
7. Twilio SMS 연동
8. 관리자 — 상품/호스트 관리 페이지 구현
9. Cloudflare Pages 배포
