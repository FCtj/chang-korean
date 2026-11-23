# 단어 데이터 작업 도구

앱에 들어간 단어 파일(`src/data/...`)을 만든 스크립트입니다. **이미 만든 결과는 저장소에 들어 있으므로**, 목록을 바꾸거나 단어를 더할 때만 다시 돌리면 됩니다.

- 모든 스크립트는 **저장소 루트에서** 실행합니다: `node tools/lao/build-lao.mjs`, `python3 tools/moe/parse-moe-en.py`
- 내려받은 원본과 중간 결과는 `tools/_work/` 에 둡니다 (git 에 안 올림). 다른 곳을 쓰려면 `CK_WORK=/경로` 환경 변수.
- "카드 만들기" 단계(뜻·그림·예문)는 원래 Claude 하위 에이전트 여러 개가 `SPEC-*.md` 를 읽고 JSON 을 쓴 뒤 `check-*.mjs` 로 검사했습니다. 다시 할 때도 같은 SPEC 과 검사기를 쓰면 됩니다.

## 1. 라오스어판 (`tools/lao/`)

| 순서 | 스크립트 | 하는 일 |
|---|---|---|
| ① | `build-lao.mjs` | 한국어판 단원(TOPIK 1~6급 · 상황별)의 한국어 단어 → 라오어 뜻 중 **라오스 정부 사전에 있는 말**만 → `src/data/lo/level-1..3.ts`, `daily-1..3.ts` (예문은 한국어판 예문의 라오어 번역) |
| ② | `freq.mjs` | HVULao_NLP 말뭉치로 라오어 단어 빈도 → `tools/_work/lao/freq.json` |
| ③ | `prep-freq.mjs` | 앱에 없는 자주 쓰는 말 1,000개 → 일감 `tools/_work/lao/freq-work/in-1..8.json` |
| ④ | (에이전트) | `SPEC-freq.md` 대로 `out-N.json` 작성 → `node tools/lao/check-freq.mjs in-N.json out-N.json` |
| ⑤ | `build-freq.mjs` | → `src/data/lo/freq-1.ts`, `freq-2.ts` (필수 ①②) + `index.ts` 레벨 순서 |

필요한 원본 (`tools/_work/lao/`):
```bash
# LaoNLP (Apache-2.0) — 라오스 정부 lao-eng-dictionary.csv (MIT) · 위키낱말사전 목록이 들어 있음
pip download laonlp==1.3.0 --no-deps -d tools/_work/lao/dl
python3 -m zipfile -e tools/_work/lao/dl/laonlp-1.3.0-py3-none-any.whl tools/_work/lao/dl/whl
# HVULao_NLP 띄어쓰기 말뭉치 (빈도 계산에만 씀, 문장은 앱에 넣지 않음)
mkdir -p tools/_work/lao/hvu && cd tools/_work/lao/hvu
curl -LO https://raw.githubusercontent.com/HaHVU/HVULao_NLP/main/Datatrain10k/10ksegmented.txt
curl -LO https://raw.githubusercontent.com/HaHVU/HVULao_NLP/main/Datatest1k/testsegsent_1000.txt
```
라오 글자 → 로마자·한글 읽기는 앱 코드 `src/lao.ts` (음절 나누기는 LaoNLP 정규식을 옮긴 것).

## 2. 교육부 기본 어휘 (`tools/moe/`)

| 스크립트 | 하는 일 |
|---|---|
| `parse-moe-en.py` | 경기도교육청 PDF(2022 개정 영어과 [별표 3]) 텍스트 → `moe-en.json` (3,001개, `*` 초등 · `**` 중·고 공통) |
| `parse-moe-ja.py` | 국제교류기금 번역판 docx([別表I] 基本語彙表) → `moe-ja.json` |
| `prep-moe.mjs` | 앱에 이미 있는 카드 찾기 + 없는 단어 일감 (`tools/_work/drive/work/en-in-*.json`, `ja-in-1.json`) |
| `ipa-map.py` | 새 영어 단어 발음(CMU → IPA, 강세 위치 고침) |
| (에이전트) | `SPEC-cards.md` → `*-out-*.json`, 검사 `check-cards.mjs` |
| `build-moe.mjs` | → `src/data/en/moe-1..3.ts`, `src/data/ja/moe-1..2.ts` |

- 이미 뽑은 목록: `tools/moe/data/moe-en.json`, `moe-ja.json` (스크립트는 `tools/_work/drive/` 에서 읽으므로 복사해서 사용).
- 원본 파일(PDF·docx)은 사용자의 구글 드라이브 폴더에 있습니다 (링크는 사용자에게 문의). PDF 텍스트: `pdftotext -layout moe-english.pdf moe-english.txt`.
- 순서·발음에 쓰는 원본: `tools/_work/src-data/en/` (NGSL_12_stats.csv, word_ranks.csv, olp-cefrj-vocabulary-profile-1.5.csv), `src-data/cmu/cmudict.dict`, `src-data/jlpt/jiten_freq_global.csv` — 출처는 `src/data/en/SOURCES.md`, `src/data/ja/SOURCES.md`.

## 3. 일본어·영어판 처음 만들 때 (`tools/edition/`)
- `skeleton.py` / `daily-skeleton.py`: JLPT·TOEIC·생활 목록 → 단원 뼈대 · `spec2.md` / `spec2-daily.md`: 카드 만들기 지침 · `check-chunk.mjs`: 검사 · `build-ts.py` / `build-daily.py`: → `src/data/ja|en/*.ts`
- `fix-ipa-stress.py`: 영어 IPA 강세 표시를 음절 첫머리 앞으로 (`--write`)
- `emoji-compat.py`: Emoji 14 이후 그림을 예전 그림으로 바꾼 일회성 도구 (`npm test` 의 `check-emoji` 가 다시 생기지 않게 막음)

## 4. 화면 점검 (`tools/smoke/`)
빌드(`npm run build:single && npm run build:editions`) 후 저장소 루트에서 `node tools/smoke/<이름>.mjs`. 스크린샷은 `tools/_work/` 아래에 저장.
- `device-activity.mjs`: 로그인하지 않은 기기 기록이 서버로 가는지 (판마다)
- `lo-smoke.mjs` · `lo-freq-smoke.mjs`: 라오스어판 · `daily-smoke.mjs`: 판 두 번째 코스 · `toast-shot.mjs`: 공부 화면 안내(토스트) · `feedback-smoke.mjs`: 수정 요청 · `rank-shot2.mjs`: 랭킹(이름 가림·사진 모자이크 — `tools/_work/faces.json` 필요) · `smoke50.mjs`: 일본어·영어 발음 소리 · `carbon-shot.mjs`: 어두운 테마 로고
- Playwright 는 `require('playwright')` 를 먼저 찾고, 없으면 클라우드 환경 경로(`/opt/node22/...`)를 씁니다.
