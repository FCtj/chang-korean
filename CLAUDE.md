# Chang Korean — Claude 작업 규칙

이 저장소를 이어받는 Claude(Claude Code · Cowork)용 규칙입니다. **지금 상태와 남은 일은 [`docs/HANDOFF.md`](docs/HANDOFF.md)**, 단어 데이터 작업은 [`tools/README.md`](tools/README.md) 를 먼저 읽으세요.

## 사용자와 일하는 방식
- 사용자와는 **한국어**로 대화합니다. 짧고 쉬운 말로, 결과를 화면(스크린샷)으로 보여 주면 좋아합니다.
- 바꾼 것은 **끝나는 대로 바로 배포**하는 것을 원합니다 (아래 배포 방법).
- PR 은 사용자가 말할 때만 만듭니다.
- 이 프로젝트는 회사 저장소와 섞지 않습니다 (이 저장소에서만 작업).
- 사용자의 이메일·개인정보를 외부 서비스로 보내지 않습니다.

## 절대 하지 않을 것
- **비밀 키를 저장·커밋·요청하지 않음**: Supabase secret / service_role 키, Facebook App Secret, Kakao Client Secret.
  `src/config.ts` 에는 공개값만 (Supabase URL, publishable key, Facebook App ID). 빌드 결과는 `scripts/check-no-secrets.mjs` 가 검사합니다.
- git 기록 다시 쓰기(force push, 예전 사진 4장 기록 지우기 등)는 사용자가 그 자리에서 분명히 허락할 때만.
- 시험을 끄거나 건너뛰어서 통과시키지 않음.

## 앱 구조 (요약)
- React 19 + Vite + TypeScript + Capacitor(안드로이드·iOS). 웹은 GitHub Pages.
- **판(edition)** — 같은 코드로 4개 앱을 빌드 (`VITE_EDITION`, `src/edition.ts`):
  - `ko` (기본, `/`): 외국인(라오스·태국·베트남·몽골·레바논)이 한국어를 배움
  - `ja` (`/ja`): 한국인이 일본어 — JLPT N5~N3 + 학교·생활 일본어
  - `en` (`/en`): 한국인이 영어 — TOEIC 450~900+ + 교육부 기본 어휘 3,000
  - `lo` (`/lo`): 한국인이 라오스어 — 입문·필수①·초급·필수②·중급 + 상황별
- 단어 데이터: `src/data/` (한국어판 `track-*.ts`, 판별 `ja/ en/ lo/` — 각 폴더 `SOURCES.md` 에 출처).
- 서버: Supabase. 마이그레이션 `supabase/migrations/*.sql` → `cat supabase/migrations/*.sql > supabase/schema.sql`.
  새 마이그레이션은 **사용자가 Supabase SQL 편집기에서 실행**해야 반영됩니다 (실행했는지 꼭 확인).
- 기능 스위치 `src/config.ts`: `COMMUNITY_ENABLED=false` · `RANKING_ENABLED=true` · `POINTS_ENABLED=false` · `ALWAYS_MASK=true`(테스트 기간: 남에게 보이는 이름 일부 가림·사진 모자이크) · `SAMPLE_DATA=false`.

## 명령
```bash
npm test                 # 단어·번역·판 데이터·그림(Emoji 13 이하) 검사
npm run test:db          # Supabase 스키마 테스트 (PGlite) — schema.sql 을 먼저 다시 만들 것
npx tsc --noEmit -p .    # 타입 검사
npm run build:single     # 한국어판 웹 → dist-web/
npm run build:editions   # 일본어·영어·라오스어판 → dist-web/ja · en · lo
node tools/smoke/<이름>.mjs   # 화면 점검 (Playwright, 빌드 후 저장소 루트에서)
```

## 배포
작업 브랜치는 `wip-examples`. 끝나면:
```bash
git push origin wip-examples
git push origin wip-examples:main     # main 에 올라가면 GitHub Pages 가 배포 (.github/workflows/pages.yml)
```
Pages 워크플로는 `npm test` → `build:single` → `build:editions` 순서로 돌고, 하나라도 실패하면 배포되지 않습니다.

## 데이터 규칙
- 단어는 **출처가 있는 목록**을 바탕으로 (AI 가 임의로 고른 목록 X). 출처는 각 판 `SOURCES.md` 와 설정 화면 '단어 출처'.
- 그림(이모지)은 **Emoji 13 이하만** — 오래된 폰에서 빈 네모가 됨 (`scripts/check-emoji.mjs`). 같은 단원 안에서 그림·뜻이 겹치면 안 됨.
- 카드 앞면(외울 말)에는 그림을 보여 주지 않음 — 그림이 답을 알려 주기 때문 (설정 '앞면에 그림 힌트'로만 켬).
- 판 단어 파일 형식·검사: `src/data/edition-types.ts`, `scripts/check-edition.mjs`, `scripts/check-editions.mjs`.
- 뜻·예문 중 앱에서 새로 쓴 것은 '초안' — 사용자들이 앱의 「틀린 곳 알리기」로 보낸 요청은 관리자 화면 📮 에서 확인.
