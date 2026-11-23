# 인수인계 — 지금 상태와 남은 일 (2026-11-23)

다른 Claude 세션(Claude Code · Cowork)이 이어서 작업할 수 있게 정리한 문서입니다. 작업 규칙은 [`CLAUDE.md`](../CLAUDE.md), 단어 데이터 도구는 [`tools/README.md`](../tools/README.md).

## 사이트
| 앱 | 주소 | 대상 |
|---|---|---|
| 한국어판 (Chang Korean) | https://fctj.github.io/chang-korean/ | 라오스·태국·베트남·몽골·레바논 사람이 한국어 |
| 일본어판 (Chang Japanese) | https://fctj.github.io/chang-korean/ja/ | 한국인이 일본어 |
| 영어판 (Chang English) | https://fctj.github.io/chang-korean/en/ | 한국인이 영어 |
| 라오스어판 (Chang Lao) | https://fctj.github.io/chang-korean/lo/ | 한국인이 라오스어 |

## 회사 소개 사이트 (니즈랩 NeedsLab)
- 원본 `site/needslab/` (한 파일 HTML · 한국어/English · 밝게/어둡게) → 빌드 때 `dist-web/needslab/` 로 복사 (`scripts/make-standalone.mjs`), 앱 아이콘은 `store/`.
- 지금 주소(미리보기): https://fctj.github.io/chang-korean/needslab/
- 회사 정보(사업자등록증명 2026-11-23 발급 기준, 공개 정보만): 상호 니즈랩 · 대표 임태준 · 사업자등록번호 540-10-03426 · 경기도 성남시 중원구 자혜로113번길 3, B2호(은행동) · 개업 2026-06-01 · 정보통신업 / 응용 소프트웨어 개발 및 공급업. 주민번호·발급번호는 어디에도 넣지 않음.
  - 회사 사이트 아래쪽(`site/needslab/index.html` footer + JSON-LD), 개인정보처리방침 '9. 문의'(`scripts/make-standalone.mjs` 의 `operator` · `operatorEn`) 두 곳에 같은 내용 — 바뀌면 둘 다 고칠 것.
  - 문의 메일은 앱과 같은 `iamexample2@gmail.com` (`src/config.ts` `CONTACT_EMAIL`, 회사 사이트 스크립트 `CONTACT_EMAIL`).
  - 지금은 무료 앱이라 통신판매업 신고 번호 없음. 유료 결제를 붙이면 신고 후 아래쪽에 번호 추가.
- 도메인 needslab.kro.kr: 저장소 `FCtj/needslab-site` (2026-11-23 첫 배포, Pages Source = GitHub Actions, CNAME needslab.kro.kr).
  - 고치는 순서: 이 저장소 `site/needslab/` 를 고침 → 미리보기(/needslab/) 확인 → 같은 파일을 needslab-site 저장소 맨 위에 복사해 main 에 push (그 저장소의 워크플로가 배포).
  - **주의**: 저장소 이름을 `FCtj.github.io` 로 하고 도메인을 붙이면 앱 주소(fctj.github.io/chang-korean)까지 needslab.kro.kr 로 옮겨져 로그인·학습 기록이 끊김. 별도 이름 저장소만 쓸 것.

## 판별 내용
- **일본어판**: JLPT N5·N4·N3 (3,449) + 학교·생활 일본어 = 교육과정 기본 ①②(2022 개정 고교 「일본어」 기본 어휘표 896) → 생활 회화 ①②③(JMdict 상용어 900). 마스코트 시바견.
- **영어판**: TOEIC 450~900+ (TSL+NGSL 3,359) + 교육부 기본 어휘(2022 개정 [별표 3] 3,001 — 초등 801 · 중·고 공통 1,200 · 고교 선택 1,000). 마스코트 흰머리수리.
- **라오스어판**: 입문 263 · 필수① 500 · 초급 232 · 필수② 491 · 중급 664 + 상황별(여행·관광 183 · 식당·쇼핑 162 · 일·생활 492) = 2,989개 + 상황 문장 592.
  - 라오어는 라오스 정부 사전(lao-eng-dictionary, MIT)·위키낱말사전에 있는 말만. 필수 ①② 는 HVULao_NLP 말뭉치 빈도순.
  - 읽기는 `src/lao.ts` (로마자 · 한글, **성조 표시 없음**). 대부분의 폰에 라오어 음성(TTS)이 없어서 한글 읽기로 안내.
  - 마스코트 코끼리, 로고 = 라오스 국기 색 + 코끼리.
- 세 판 공통: 카카오·Facebook 로그인, 판마다 따로 기록(`edition_progress` · `edition_activity`)·랭킹(`edition_points`), 수정 요청, 카드 앞면 그림 숨김, 밝게/어둡게/기기 설정 테마.

## 최근 바뀐 것 (git log 참고)
- 수정 요청 · 제안 기능 (카드 ? 창 · 설정 → 관리자 화면 📮) — `feedback` 표
- 랭킹 다시 켬: 한국어판은 기본 '전체'부터, 판은 판마다 따로. **예시 사용자 없음**(실제 가입자만), 0점 가입자도 아래쪽에 보임
- 테스트 기간 `ALWAYS_MASK`: 남에게 보이는 이름 일부 가림(김*나) · 사진 모자이크
- 가입하는 순간 서버가 프로필을 만듦 (`handle_new_user` 트리거)
- 로그인하지 않아도 기기마다 임의 번호로 하루 공부 합계를 서버에 남김 (`device_activity`) → 관리자 화면 📱 '로그인 안 하고 쓰는 사람'. 그 기기에서 로그인하면 계정과 이어짐. 개인정보처리방침 7개 언어에 반영
- Emoji 14 이후 그림 217개 교체 + `npm test` 에 검사 추가, 영어 IPA 강세 위치 1,170개 고침
- 일본어 한 글자 단어(歯·二)는 가타카나로 읽힘 (조사·다른 읽기 방지)

## 로그인 시도 (관리자 🔑)
- 앱이 로그인 버튼(start)·성공·오류로 돌아옴(error)·그냥 돌아옴(abandoned)을 `log_login_attempt` 로 남김 (기기 번호·브라우저 종류 포함, `src/backend.ts` `logLogin`).
- 관리자 화면 🔑: 앱·방법별 합계, 실제로 생긴 계정, 서버에 남은 끝나지 않은 OAuth(auth.flow_state), 최근 40건. 친구가 '가입했다'는데 계정이 없을 때 여기서 원인 확인.
- 점검: `node tools/smoke/login-attempts.mjs`

## 오프라인
- 웹: 판 폴더마다 `sw.js`(서비스 워커)·`manifest.webmanifest` 를 `scripts/make-standalone.mjs` 가 만듦 → 한 번 열면 인터넷 없이도 열림, '홈 화면에 추가' 가능. 인터넷이 되면 언제나 서버의 새것을 먼저 받음(`src/offline.ts`).
- 끊긴 동안의 공부 기록(기기·계정)·점수는 `chang-offline-queue:<판>` 에 모았다가 다시 연결되면 보냄(`src/backend.ts` `flushOfflineQueue`).
- 점검: `node tools/smoke/offline.mjs`

## Supabase (사용자가 SQL 편집기에서 직접 실행)
`supabase/migrations/` 순서대로. 사용자가 2026-11-23 에 `20261123010000_admin_real_names.sql` 까지 실행했다고 함.
**실행 부탁 중**: `20261123020000_login_attempts.sql` (로그인 시도 기록 · 관리자 🔑 칸)
새 마이그레이션을 만들면 사용자에게 실행을 부탁하고, 아래처럼 확인 SQL 을 드려서 결과를 받기 (클라우드 세션은 Supabase 에 직접 접속 못 함).

확인용 SQL 예: `select to_regprocedure('public.handle_new_user()') is not null, to_regclass('public.device_activity') is not null, pg_get_function_result('public.admin_users(text,text,int,int)'::regprocedure) like '%login_name%';`

## 남은 일 (중요한 순)
1. **EPS 라오스어 교재 어휘** — 고용허가제 한국어 표준교재 라오스어판 1·2권의 **부록 어휘 목록 페이지**를 사용자가 10MB 이하 PDF 로 올려 주기로 함 (드라이브 연결 다운로드 한도 10MB, 1권은 0바이트로 올라감). 받으면 정부 번역과 대조해 한국어판·라오스어판의 라오어 뜻 초안을 고침.
2. **라오어 원어민 소리** — FSI Lao Basic Course 음성(MP3, 퍼블릭 도메인)을 사용자가 받아 주면 단어·문장 소리로 넣기. FSI 1권 PDF 는 받았지만 본문이 옛 라오 글꼴 인코딩(예: `¦½®¾¨©ó` = ສະບາຍດີ)이라 변환표가 필요.
3. NIU SEAsite "Spoken Lao" lesson1~30(원어민 MP3) — 이용 조건이 없어 앱에는 안 넣음. 쓰려면 NIU 허락 필요.
4. 라오어 성조 표시 (지금 읽기에는 성조 없음).
5. 뜻·예문 초안 검수 — 수정 요청(관리자 화면 📮)으로 들어오는 것 반영.
6. 포인트 정책 정하기 (`POINTS_ENABLED=false`, 점수는 랭킹에만 씀). 테스트가 끝나면 `ALWAYS_MASK=false`.
7. Facebook 앱이 '개발 모드'면 역할 없는 사람은 로그인 못 함 → Meta 대시보드에서 Live 로 (개인정보처리방침·데이터 삭제 안내 페이지는 준비됨). 카카오는 Supabase 에 Kakao provider 켜기·Redirect URL `https://fctj.github.io/chang-korean/**` 확인.
8. 예전 사진 4장 git 기록 지우기 — 사용자 명시 승인 필요 (보류).

## 환경 메모 (클라우드 세션)
- 많은 사이트가 막혀 있음: `*.supabase.co`, korean.go.kr, goe.go.kr, jpf.go.jp, huggingface.co, kaikki.org, Google 번역 등. raw.githubusercontent.com · PyPI · npm 은 됨. 막힌 자료는 사용자가 내려받아 구글 드라이브로 전달.
- 구글 드라이브 연결은 10MB 넘는 파일을 못 받음.
- 사용자 PC(Claude Code 로컬)에서는 이런 제한이 없으니 Supabase 확인·큰 파일 처리는 로컬이 편함.
