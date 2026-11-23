# Write two more Japanese example sentences per word (Chang Japanese)

Chang Japanese is a flashcard app for **Korean speakers learning Japanese**. Each word already has one example sentence (`ex1` / `ko1`). Your job: write **two more** example sentences per word, so every word gets three in total.

**The words are fixed.** Never add, drop or respell a word, and never change `ex1`.

## Input / output

Read: `tools/_work/exmore/ja/in-NN.json`

Each item looks like this:
`{ term, reading (kana), meaning (Korean), level, ex1, ko1 }`

Write: `tools/_work/exmore/ja/out-NN.json`, one JSON object keyed by `term` that covers every item:

```json
{
  "歯": [
    { "ex": "歯が痛くて、ご飯が食べられません。", "rom": "はがいたくて、ごはんがたべられません。", "ko": "이가 아파서 밥을 못 먹어요." },
    { "ex": "子どもの歯が一本抜けました。", "rom": "こどものはがいっぽんぬけました。", "ko": "아이 이가 하나 빠졌어요." }
  ]
}
```

- `ex`: the Japanese sentence.
- `rom`: the full kana reading of `ex`.
  - Write it in hiragana. Katakana words stay katakana.
  - Keep the same punctuation as `ex`.
  - Write numbers as they are read (二十歳 → はたち, 十分 → じゅっぷん).
- `ko`: a natural Korean translation of `ex`.

Write the JSON with a script or in pieces if that is easier. The final file must be valid JSON.

## Rules

1. **Same sense.** Use the word in the sense given by `meaning`. The examples are there to teach that meaning.
   - 歯 means "tooth", so 歯を磨く / 歯が痛い.
   - 在る means "to exist (at a place)", so a location sentence.
   - 有る means "to have", so a possession sentence.
2. **Different from `ex1` and from each other.**
   - Use a different situation.
   - Use a different grammar pattern where natural: past, negative, question, 〜たい, 〜てください, 〜ている, a conditional, and so on.
   - Do not just swap one noun in `ex1`.
   - Show the most common collocations. Together the three sentences should give a learner a feel for how the word is really used.
3. **Natural.** Write what a native speaker would actually say or write. Avoid textbook translationese and odd topics.
4. **Short.** Aim for 12–30 characters. The hard limit is 45.
5. **Level and register.** Match `ex1`.
   - `n5` / `n4` / `moe-1` / `moe-2`: です/ます style. Mostly N5–N4 vocabulary and grammar. Easy kanji, or kana for hard words.
   - `n3` / `daily-*`: natural everyday Japanese. Plain or polite, whichever fits the situation, like `ex1`.
6. **Use the word itself.** A conjugated form is fine. For a kana-only word, use kana.
   - For affixes and counters such as 〜枚 or 〜さん, use them attached to a word (三枚, 田中さん).
   - For grammar words such as と, でも or なんて, show the typical use.
7. **`ko` translation**
   - Use natural 해요체. Use 반말 only when `ex` is clearly casual speech to a friend (〜よう, 〜て, 〜ね with plain form), as `ko1` does.
   - Translate faithfully: no added or missing content.
   - Write Korean only: no kana, and no kanji unless they are in brackets.
8. **No real people or brands, and nothing sensitive.** Use common names (田中さん, 母, 友だち) and everyday topics: school, work, family, shopping, travel, weather, food, health, hobbies.
9. **Originality.** Do not copy sentences from textbooks, dictionaries or exams.

## Validate (must pass), then report

Run from the repository root:

```
python3 -I tools/exmore/check-ja.py NN
```

- **✗ = error.** Fix every one.
- **△ 읽기 확인.** The SudachiPy analyzer read the sentence differently.
  - Sudachi is often wrong on numbers, counters and 私/日本/何/明日. Look at each one and fix only the cases where *your* `rom` is wrong.
  - Ignore it when your reading is right. For example, 一日中 = いちにちじゅう and 三本 = さんぼん are correct.
- **△ 단어가 안 보임.** Make sure the word really appears, conjugated is fine.
- **△ 조금 김.** Shorten the sentence if you can.

Final report, under 60 words per chunk:
- the validator line;
- how many reading warnings you fixed versus left as Sudachi mistakes;
- anything doubtful.
