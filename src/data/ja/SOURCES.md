# 일본어판 단어 데이터 출처

| 무엇 | 출처 | 라이선스 |
|---|---|---|
| JLPT N5 · N4 · N3 단어 목록 (표기·읽기·영어 뜻) | Jonathan Waller, *JLPT Resources* — https://www.tanos.co.uk/jlpt/ | CC BY |
| 위 목록의 정리판 | Jamie Sinclair, *open-anki-jlpt-decks* — https://github.com/jamsinclair/open-anki-jlpt-decks | MIT |
| 단원 순서 (자주 쓰는 순) | Jiten global frequency list — https://jiten.moe/frequency-dictionaries | CC BY-SA 4.0 |
| 생활 일본어 단어 (JLPT 목록 밖) | JMdict — Electronic Dictionary Research and Development Group (EDRDG), 상용어 표시 news1·ichi1·spec1·spec2·gai1 | CC BY-SA 4.0 |
| 교육과정 기본 어휘 ①② | 2022 개정 제2외국어과 교육과정 고등학교 「일본어」 [별표 Ⅰ] 기본 어휘표 — 국제교류기금(JPF) 해외 일본어 교육 조사 자료의 일본어 번역판에서 옮김 | 공공 교육과정 고시 |
| 한국어 뜻 · 예문 · 예문 번역 · 그림 | 이 앱에서 새로 씀 (초안, 검수 전) | 아래 |

- 표기에 이형이 여럿인 단어(예: `足; 脚`)는 대표 표기 하나만 쓰고, 목록의 메모(`(かん)`, `(する)`)는 뺐습니다.
- 공식 JLPT 어휘 목록은 2010년 개편 이후 공개되지 않습니다. 위 목록은 옛 출제기준과 기출을 바탕으로 널리 쓰이는 비공식 목록입니다.
- Jiten 빈도 순위를 써서 가공한 이 데이터(`n5.ts` · `n4.ts` · `n3.ts`)는 **CC BY-SA 4.0** 으로 배포합니다.
- 생활 일본어: JMdict 상용어 중 JLPT N5~N1 목록에 없는 말을 Jiten 빈도 순으로 900개 (조사·조동사·접사·관용 표현·지명·인명은 뺌). `daily-*.ts` 도 **CC BY-SA 4.0**.
- 교육과정 기본 어휘: 조사·조동사·접사(〜 · - 표시)는 빼고 896개. Jiten 빈도 순으로 반씩 ①② · 25개씩 Day 단원. JLPT·생활 코스와 겹치는 850개는 같은 뜻·예문, 나머지는 새로 씀.

## 예문 ②③ (2026-11-23)
- 단어마다 예문 2개를 더함 (`ex-more-1..4.ts`, 4,394단어 · 8,788문장) — 이 앱에서 새로 쓴 초안 (원어민·전문가 검수 전).
- 가나 읽기는 SudachiPy(Apache-2.0, 사전 sudachidict_core)로 대조해 확인. 만든 도구: `tools/exmore/`.
