# 니즈랩(NeedsLab) 회사 소개 사이트

한 파일(`index.html`)짜리 정적 사이트 — 한국어/English, 밝게/어둡게, 휴대폰 화면.
지금은 앱 저장소 빌드가 `https://fctj.github.io/chang-korean/needslab/` 에 미리보기로 올림 (`scripts/make-standalone.mjs`).

## needslab.kro.kr 로 옮기기
이 폴더는 그대로 새 저장소의 맨 위가 되도록 만들어 둠 (`CNAME` · `.nojekyll` · `.github/workflows/pages.yml` 포함).

1. GitHub 에서 새 저장소 만들기 (예: `needslab-site`, Public) → 이 폴더 내용을 그대로 올림
2. 저장소 **Settings → Pages → Source: GitHub Actions** → 첫 배포가 끝날 때까지 기다림
3. **Settings → Pages → Custom domain** 에 `needslab.kro.kr` (CNAME 파일과 같은 값) 저장
4. 내도메인.한국에서 `needslab.kro.kr` 레코드 설정 — 둘 중 하나
   - **CNAME** → `fctj.github.io` (저장소 주인 계정의 github.io)
   - 또는 **A(IP 연결)** 4개 → `185.199.108.153` · `185.199.109.153` · `185.199.110.153` · `185.199.111.153`
5. DNS 가 퍼지면(몇 분~몇 시간) Pages 화면의 DNS 확인이 통과 → **Enforce HTTPS** 켜기

## 고칠 곳
- 문의 메일: `index.html` 아래 스크립트의 `CONTACT_EMAIL`
- 앱 링크: 앱은 계속 `fctj.github.io/chang-korean/` (로그인 설정·학습 기록이 그 주소에 묶여 있음)
- 공유 미리보기 그림 `og.png` (1200×630) — 첫 화면을 찍은 것
