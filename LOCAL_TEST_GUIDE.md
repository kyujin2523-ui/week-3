# K-SHOP 로컬 테스트 가이드

## 전제 조건

```bash
node --version   # v18 이상
npm --version    # v9 이상
firebase --version  # 없으면: npm install -g firebase-tools
stripe --version    # 없으면: brew install stripe/stripe-cli/stripe
```

---

## STEP 1 — Firebase 프로젝트 생성 (최초 1회)

1. https://console.firebase.google.com 접속
2. 프로젝트 추가 → 이름: `kshop`
3. **Authentication** 활성화
   - Sign-in method → 이메일/비밀번호 → 사용 설정
4. **Firestore Database** 생성
   - 테스트 모드로 시작 (나중에 rules 배포)
5. 프로젝트 설정 → 앱 추가 → 웹 앱 → 앱 등록
   - Firebase SDK 설정 값 복사

---

## STEP 2 — 코드 설치

```bash
# 이 프로젝트 폴더에서
npm install

# Functions 폴더 따로 설치
mkdir functions
cp functions-package.json functions/package.json
cp tsconfig.json functions/tsconfig.json   # 복사 후 "noEmit": false 로 수정
cd functions && npm install && cd ..
```

---

## STEP 3 — 환경 변수 설정

```bash
cp .env.local.example .env.local
```

`.env.local` 파일을 열어서 Firebase 콘솔에서 복사한 값 입력:

```
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=kshop.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=kshop
VITE_FIREBASE_STORAGE_BUCKET=kshop.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc

VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51...
VITE_FUNCTION_URL=http://localhost:5001/kshop/asia-northeast1/createCheckout
```

---

## STEP 4 — Firebase 로그인 + 프로젝트 연결

```bash
firebase login
firebase use --add   # 방금 만든 kshop 프로젝트 선택
```

---

## STEP 5 — 에뮬레이터 시작

```bash
# 터미널 A — Firebase 에뮬레이터 (Firestore + Auth + Functions)
firebase emulators:start --import=./emulator-data --export-on-exit=./emulator-data
```

브라우저에서 http://localhost:4000 열리면 에뮬레이터 UI 확인 가능.

---

## STEP 6 — 시드 데이터 생성

에뮬레이터가 실행 중인 상태에서 **새 터미널**:

```bash
# 터미널 B
npx ts-node --esm scripts/seed.ts
```

출력 예시:
```
🌱 K-SHOP 시드 데이터 생성 시작
① 관리자 계정 생성
  ✓ admin@kshop.kr (uid: abc123)
② 테스트 호스트 생성
  ✓ host@test.com (uid: def456)
③ 상품 15개 생성
  ...............
  ✓ 15개 생성
④ 테스트 주문 3건 생성
  ✓ KS-0001 — Emma Rodriguez (new)
  ✓ KS-0002 — Yuki Tanaka (processing)
  ✓ KS-0003 — Chen Wei (done)

✅ 시드 완료!
테스트 계정:
  관리자: admin@kshop.kr / admin1234!
  호스트: host@test.com  / host1234!

고객 주문 URL: http://localhost:5173/?host=def456
```

---

## STEP 7 — 프론트엔드 실행

```bash
# 터미널 C
npm run dev
```

---

## STEP 8 — 각 화면 테스트

| URL | 계정 | 확인 항목 |
|-----|------|-----------|
| `http://localhost:5173/` | admin@kshop.kr / admin1234! | 관리자 대시보드, 주문 3건 표시 |
| `http://localhost:5173/?host={hostId}` | 없음 (게스트) | 상품 목록, 언어 전환, 장바구니 |
| `http://localhost:5173/host` | host@test.com / host1234! | 호스트 포털, 주문 내역, QR |

---

## STEP 9 — Stripe 결제 테스트 (선택)

```bash
# 터미널 D — Stripe 웹훅 로컬 전달
stripe listen --forward-to localhost:5001/kshop/asia-northeast1/stripeWebhook
# 출력된 Webhook signing secret을 functions/.env 에 저장
```

`functions/.env` 파일 생성:
```
STRIPE_SECRET_KEY=sk_test_51...
STRIPE_WEBHOOK_SECRET=whsec_...
```

결제 테스트 카드:
```
번호: 4242 4242 4242 4242
유효기간: 아무거나 (예: 12/34)
CVC: 아무거나 (예: 123)
```

---

## 자주 겪는 문제

**에뮬레이터 포트 충돌:**
```bash
lsof -ti:8080 | xargs kill -9
lsof -ti:9099 | xargs kill -9
lsof -ti:5001 | xargs kill -9
```

**시드 스크립트 오류 (ts-node not found):**
```bash
npm install -D ts-node
npx ts-node --esm scripts/seed.ts
```

**에뮬레이터 데이터 초기화:**
```bash
rm -rf ./emulator-data
firebase emulators:start  # 빈 상태로 다시 시작
```

**React 에러 (Cannot find module):**
```bash
npm install  # 패키지 재설치
```
