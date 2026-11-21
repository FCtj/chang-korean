# 아이폰(iOS) 앱

안드로이드 앱과 같은 코드로 아이폰 앱도 만들 수 있게 **미리 세팅해 두었습니다** (Capacitor iOS).

## 이미 되어 있는 것

| 항목 | 내용 |
|---|---|
| iOS 프로젝트 | `ios/` 폴더 (Xcode 프로젝트, Swift Package Manager 방식 — CocoaPods 필요 없음) |
| 앱 정보 | 이름 **Chang Korean**, 번들 ID `com.changkorean.app` (안드로이드 패키지 이름과 같음), iOS 15 이상 |
| 아이콘 · 시작 화면 | 분홍 코끼리 아이콘(1024px), 연분홍 시작 화면 |
| 화면 방향 | 아이폰은 세로만 |
| Facebook 로그인 복귀 | `com.changkorean.app://auth-callback` 주소로 앱에 돌아오도록 URL 스킴 등록 |
| 발음(TTS)·브라우저·앱 상태 | 안드로이드와 같은 플러그인이 iOS도 지원 |
| 프로필 사진 | 사진첩·카메라 사용 안내 문구(Info.plist) 등록 |
| 자동 빌드 확인 | `.github/workflows/ios.yml` — main에 올리면 GitHub의 Mac 서버에서 iOS 빌드가 되는지 확인 (서명 없이 시뮬레이터용) |

## 실제 아이폰에 설치하고 App Store에 내려면

1. **Apple Developer Program 가입** — 연 $99 (https://developer.apple.com/programs/)
   - 개인 또는 사업자로 가입. 사업자는 D-U-N-S 번호가 필요해서 1~2주 더 걸릴 수 있음
2. **Mac + Xcode** 로 서명해서 올리기 (가장 쉬움)
   ```
   npm run ios:sync      # 웹 빌드 → iOS 프로젝트로 복사
   npm run ios:open      # Xcode 열기
   ```
   Xcode → Signing & Capabilities 에서 Team 선택 → Product → Archive → TestFlight 업로드
   - Mac이 없으면: GitHub Actions(Mac 서버)에 서명 인증서를 넣어 자동 업로드하도록 바꿀 수 있습니다 (인증서·키는 GitHub **Secrets**에만 저장)
3. **TestFlight** 로 지인들에게 먼저 설치 (최대 1만 명, 링크로 초대)
4. **App Store 심사** 제출 — 보통 1~3일
   - 필요한 것: 스크린샷(6.9인치·6.5인치), 앱 설명, 개인정보처리방침 URL(`https://fctj.github.io/chang-korean/privacy.html`), 앱 개인정보 항목(수집 데이터 표)

## ⚠️ 출시 전에 꼭 할 것

- **Sign in with Apple 추가**: App Store 심사 지침 4.8 — Facebook 같은 소셜 로그인을 쓰면, 개인정보 보호 기능이 있는 다른 로그인(보통 "Apple로 로그인")도 함께 제공해야 합니다.
  Supabase가 Apple 로그인을 지원하므로 Apple 개발자 계정이 생기면 바로 붙일 수 있습니다.
- **계정 삭제 기능**: 지침 5.1.1(v) — 앱 안에서 계정을 지울 수 있어야 함 → 이미 있음 (설정 → 서버의 내 정보 삭제)
- 랭킹 보상(커피 쿠폰)은 "추첨/경품" 규정(지침 5.3)에 맞게 공식 규칙·Apple과 무관하다는 문구를 앱에 표시

## 참고

- 안드로이드와 아이폰은 같은 웹 코드(`src/`)를 씁니다. 화면을 고치면 두 앱 모두 바뀝니다.
- `ios/App/App/public` 과 `ios/App/App/capacitor.config.json` 은 `npx cap sync ios` 가 매번 새로 만들므로 저장소에 넣지 않습니다.
