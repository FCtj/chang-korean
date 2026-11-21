# 서버(DB) · Facebook 로그인 · 랭킹 켜기

코드는 모두 준비돼 있습니다. 아래 계정 작업(약 20~30분)을 하고 **주소와 키 2개**만 넣으면
Facebook 로그인, 사용자 정보·학습 기록 저장, 나라별 실시간/월간 랭킹이 켜집니다.
키를 넣기 전까지 앱은 지금처럼 "예시 랭킹"으로 동작합니다.

## 무엇이 저장되나요

| 테이블 | 내용 | 누가 볼 수 있나 |
|---|---|---|
| `profiles` | Facebook 이름, 프로필 사진 주소, 나라 | 누구나 (랭킹에 표시) |
| `progress` | 학습 기록 (STEP, 외운 단어, 통과한 회차, 시험 점수) | 본인만 |
| `point_events` | 점수 기록 (언제 몇 점) | 누구나 (랭킹 계산) |

- 점수는 앱이 직접 쓸 수 없고 서버 함수 `award_points` 로만 적립됩니다.
  공부 점수는 한 번에 최대 10점·하루 400점, 졸업시험 보너스는 회차마다 한 번(100점), 승급 보너스는 계급마다 한 번(300점).
- 랭킹은 **실시간(오늘)** 과 **이번 달**, 그리고 **우리나라 / 전체**로 볼 수 있고, 누가 점수를 얻으면 바로 갱신됩니다.
- 하루·한 달의 기준은 라오스 시간(UTC+7)입니다.
- 설정 화면의 "서버의 내 정보 삭제"로 사용자가 직접 자기 데이터를 지울 수 있습니다 (Facebook 요구사항).

## 1. Supabase 프로젝트 만들기 (무료)

1. https://supabase.com 가입 → **New project**
   - Region: **Southeast Asia (Singapore)** 추천 (라오스·태국에서 가장 가까움)
2. 왼쪽 **SQL Editor** → 새 쿼리에 이 저장소의 [`supabase/schema.sql`](../supabase/schema.sql) 전체를 붙여 넣고 **Run**
3. **Project Settings → API** 에서 두 값을 복사해 둡니다
   - `Project URL` (예: `https://abcdxyz.supabase.co`)
   - `anon public` 키

## 2. Facebook 앱 만들기

1. https://developers.facebook.com → **My Apps → Create App**
   - 사용 사례: **Facebook 로그인으로 사용자 인증**(Authenticate and request data from users with Facebook Login)
2. **App settings → Basic**
   - `App ID`, `App Secret` 복사
   - 개인정보처리방침 URL, 사용자 데이터 삭제 안내 URL, 앱 아이콘(`store/icon-512.png`) 입력 — **라이브 모드로 바꾸려면 필수**
3. **Facebook Login → Settings → Valid OAuth Redirect URIs** 에 추가:
   `https://<1번의 프로젝트 주소>.supabase.co/auth/v1/callback`
4. 앱을 **Live** 모드로 전환 (이름·사진(`public_profile`)만 쓰므로 별도 앱 심사는 보통 필요 없음)

## 3. Supabase에 Facebook 연결

1. **Authentication → Sign In / Providers → Facebook** 켜기 → App ID, App Secret 붙여 넣기
2. **Authentication → URL Configuration**
   - Site URL: `https://fctj.github.io/chang-korean/`
   - Redirect URLs 에 추가:
     - `https://fctj.github.io/chang-korean/`
     - `com.changkorean.app://auth-callback` (안드로이드 앱용)

## 4. 앱에 주소와 키 넣기

둘 중 편한 방법 하나:

- **방법 A (권장)**: GitHub 저장소 → **Settings → Secrets and variables → Actions → Variables** 탭 →
  `SUPABASE_URL`, `SUPABASE_ANON_KEY` 두 변수 추가 → Actions에서 *Deploy web (GitHub Pages)* 다시 실행
- **방법 B**: 주소와 anon 키를 알려주시면 저장소에 넣어 드립니다
  (anon 키는 원래 공개용 키입니다. 데이터는 위의 권한 규칙(RLS)으로 보호됩니다. **service_role 키는 절대 보내지 마세요.**)

그다음 웹(https://fctj.github.io/chang-korean/)에서 **Facebook으로 계속하기**가 보이면 성공입니다.

## 참고

- **안드로이드 앱**: Facebook 로그인은 외부 브라우저에서 진행된 뒤 `com.changkorean.app://auth-callback` 으로 앱에 돌아옵니다.
  패키지 이름을 바꾸면 `src/backend.ts` 의 `NATIVE_REDIRECT`, `AndroidManifest.xml` 의 intent-filter, 3번의 Redirect URL을 함께 바꾸세요.
- **Supabase 무료 플랜**은 1주일 동안 사용이 없으면 프로젝트가 일시 정지됩니다(대시보드에서 다시 켤 수 있음). 정식 출시 때는 유료 플랜 검토.
- 로그인하지 않아도 앱은 그대로 쓸 수 있습니다. 로그인하지 않은 사람의 점수는 랭킹에 올라가지 않습니다.
- 로그인하기 전에 기기에서 쌓은 점수는 랭킹에 올리지 않습니다(조작 방지). 학습 기록(외운 단어 등)은 로그인할 때 서버 기록과 합쳐집니다.
- 데이터베이스 규칙 검사: `supabase/schema.sql` 은 PostgreSQL(PGlite)에서 점수 상한·중복 보너스·나라별 순위·권한·데이터 삭제를 검사했습니다.
