# 수정 요청 처리 (Claude 용)

사용자들이 앱의 「틀린 곳 알리기 · 제안하기」로 보낸 요청을 운영자가 골라서 Claude 에게 맡기고, Claude 가 고쳐서 배포하는 흐름입니다.

## 흐름

| 단계 | 누가 | 어디서 | 상태 |
|---|---|---|---|
| ① 요청이 들어옴 | 사용자 | 앱 '?' 창 / 설정 → 「틀린 곳 알리기」 | `new` (새 요청) |
| ② 읽고 지시를 붙여 맡김 (지시는 비워도 됨), 아니면 넘김 | 운영자 | 관리자 화면 맨 위 📮 | `todo` (맡김) · `skip` |
| ③ 「📋 Claude 에게 보낼 글 복사」 → Claude 채팅에 붙여 넣기 | 운영자 | 📮 → 맡김 탭 | |
| ④ 고치고 검사·배포한 뒤 CHANG-DONE 블록으로 보고 | **Claude** | 이 저장소 | |
| ⑤ CHANG-DONE 블록을 「Claude 결과 붙여넣기」에 넣음 → 처리함 | 운영자 | 📮 → 맡김 탭 | `done` · `skip` |

서버: `feedback` 표 (`status` new/todo/done/skip · `admin_note` = 운영자 지시 · `resolved_note` = 처리 결과), 함수는 `supabase/migrations/20261124010000_feedback_workflow.sql`.
Supabase 커넥터가 연결된 세션이면 ③⑤ 없이 Claude 가 직접 `select … from feedback where status = 'todo'` 로 읽고 끝나면 `update feedback set status = 'done', resolved_note = '…', updated_at = now() where id = …` (바꾸기 전에 운영자에게 확인).

## 붙여 넣어지는 글

```
[Chang 수정 요청] 저장소 docs/FEEDBACK.md 대로 처리해 줘 · 2026-11-24 · 2건

#41 | 🇯🇵 일본어판(ja) | 🔊 발음 | 단어: t-topik-1-d01-02 二 | 지금: に · 이(2)
  보낸 말: 치라고 읽어요
  지시: 가타카나 ニ 로 읽게 해 줘
#43 | 🇺🇸 영어판(en) | 💡 제안 | 화면 언어 ko
  보낸 말: 다크 모드에서 글씨가 조금 더 컸으면
  지시: (없음 — 알아서 판단)
```

- `단어:` = 앱의 단어 id + 배울 말. `지금:` = 그때 앱에 보이던 읽기 · 뜻.
- 분야: 🔊 발음(pron) · 📖 뜻(meaning) · 💬 예문(example) · 🖼️ 그림(picture) · 🐞 오류(bug) · 💡 제안(idea) · ✏️ 기타(other)
- `보낸 말` 은 학습자의 언어(라오어·태국어·베트남어·몽골어·아랍어)일 수 있음 → 뜻을 옮겨서 판단.

## Claude 가 할 일

1. **단어 찾기** — `node tools/feedback/find-word.mjs <앱> "<단어: 칸 그대로>"`
   - 판(ja·en·lo): 단어 id 로 레벨 파일·단원·줄 + 같은 말의 예문 ①(`EX`) · 예문 ②③(`ex-more-*.ts`).
   - 한국어판(ko): 그 한국어가 나오는 모든 곳 (단어 목록 · 번역 `tr-*` · 예문 `ex-*` · 몽골어 `exmn-*` · 아랍어 `exar-*` · 고침 `tr-fix.ts` / `ex-curation.ts`).
2. **판단**
   - **지시가 있으면 지시대로.** 다만 CLAUDE.md 의 데이터 규칙(출처 있는 단어 목록 · Emoji 13 이하 · 단원 안 그림·뜻 겹침 금지 · 카드 앞면 그림 없음)이나 사실과 충돌하면 그대로 하지 말고 `skip` + 이유 (또는 운영자에게 질문).
   - **지시가 없으면** 학습자 말이 맞는지 직접 확인해서 맞으면 고치고, 아니면 `skip` + 이유.
   - 단어 자체를 빼거나 바꾸는 요청은 출처 목록 규칙 때문에 운영자 확인을 먼저.
3. **고치기**
   - 발음: 일본어 = 행의 가나 읽기 (한 글자 단어 읽기는 `src/audio.ts`), 영어 = IPA, 라오어 = `src/lao.ts`, 한국어판 = 로마자/현지 발음 규칙 `src/pron.ts`.
   - 뜻: 행의 뜻 (한국어판은 언어별 `tr-*` / `tr-fix.ts`). 같은 단원 안에서 뜻이 겹치지 않게.
   - 예문: 판은 `EX`(①) · `ex-more-*.ts`(②③), 한국어판은 `ex-*.ts` · `ex-curation.ts`.
   - 그림: 행의 이모지 (Emoji 13 이하, 단원 안에서 겹치지 않게).
   - 오류 · 제안: 앱 코드. 큰 기능이면 바로 만들지 말고 운영자에게 제안.
   - 같은 실수가 다른 단어에도 있으면 함께 고침 (보고에 적기).
4. **검사 · 배포** — `npm test` · `npx tsc --noEmit -p .` · `npm run build:single` · `npm run build:editions` → CLAUDE.md 의 배포 (wip-examples → main). 화면이 바뀌면 스크린샷.
5. **보고** — 사람이 읽는 짧은 요약(번호마다 무엇을 어떻게) + **맨 끝에 코드 블록으로 CHANG-DONE**:

```
CHANG-DONE
#41 | done | 二 를 가타카나 ニ 로 읽게 바꿈 (n5 d01)
#43 | skip | 글씨 크기 설정은 큰 기능이라 따로 제안 — 운영자 결정 필요
```

한 줄에 하나: `#번호 | done 또는 skip | 무엇을 했는지/왜 넘겼는지` (관리자 화면이 이 줄을 읽어 처리함으로 바꿈).
