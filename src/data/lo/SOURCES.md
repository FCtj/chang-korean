# 라오스어판 단어 데이터 출처

| 무엇 | 출처 | 라이선스 |
|---|---|---|
| 배울 단어(개념) 목록 · 단원 | 이 앱 한국어판 단원 — 국립국어원 한국어 학습용 어휘 등급을 참고해 만든 TOPIK 1~6급 · 상황별(관광·호텔·식당·가게·일터·마사지·육아) 단어 | 이 앱 |
| 라오어 확인 | Lao-English Dictionary (lao-eng-dictionary.csv) — The E-Government Center, Ministry of Posts and Telecommunications of Laos | MIT |
| 라오어 확인 (보조) | 위키낱말사전 라오어 표제어 목록 (2021-07-20) · Lao-Dictionary.txt — LaoNLP 에 들어 있는 판 | CC BY-SA 3.0 · Apache-2.0 (LaoNLP) |
| 음절 나누기 | LaoNLP `syllable_tokenize` (Wannaphong Phatthiyaphaibun, PHISSAMAY et al. 정규식) | Apache-2.0 |
| 로마자 · 한글 읽기 | 이 앱의 규칙 (`src/lao.ts`) — 성조는 표시하지 않음 | 이 앱 |
| 라오어 뜻 · 예문 · 상황 문장 | 이 앱 한국어판의 라오어 번역 (초안, 원어민 검수 필요) | 이 앱 |

- 남긴 단어: 한국어판 단어의 라오어 뜻이 ① 위 사전에 그대로 있거나 ② ການ/ຄວາມ + 사전 단어(명사 만들기)이거나 ③ 사전 단어 2~3개를 음절 경계에서 이은 합성어(예: ຫ້ອງ+ນ້ຳ)이고, 예문의 라오어 문장에 그 단어가 들어 있는 것만.
- 레벨: 입문 = 한국어판 TOPIK 1급 단원, 초급 = 2급, 중급 = 3~6급. 상황별: 여행·관광(관광 안내·호텔), 식당·쇼핑(식당·가게), 일·생활(일터·EPS·마사지·육아).
- 같은 라오어가 여러 번 나오면 처음(쉬운 레벨) 것만 남김.

```
lao-eng-dictionary.csv — The MIT License (MIT)
Copyright (c) 2015 The E-Government Center, Ministry of Posts and Telecommunications of Laos
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions of
the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
```
