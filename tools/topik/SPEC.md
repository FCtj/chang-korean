# Fill new TOPIK vocabulary units (Chang Korean)

Chang Korean is a flashcard app for **foreigners learning Korean**. The learners speak Lao, Thai, Vietnamese, Mongolian or Arabic. Every card shows:

- a Korean word;
- its meaning in the learner's language;
- one emoji.

Each word also has one example sentence in Korean, with translations.

We are adding new units to the TOPIK levels. The words come from the National Institute of Korean Language learner vocabulary list (2003). A unit is 25 words plus 5 short sentences.

**The words are fixed.** Never add, drop, reorder or respell a word.

## Input / output

Read: `tools/_work/topik/in-NN.json`. It is a list of units, each `{ level, key, title, words: [...] }`.

- `status: "new"`: you write everything for this word. You get:
  - `pos`, the part of speech (명 noun · 동 verb · 형 adjective · 부 adverb · 대 pronoun · 관 determiner · 수 numeral · 의 bound noun · 보 auxiliary verb/adjective · 감 interjection);
  - `orig`, the Hanja origin when there is one;
  - `senses`, all list entries with the same spelling.
- `status: "reuse"` / `"moved"`: these words already exist with meanings and an emoji. Do not write anything for them, but your new meanings and emojis must not clash with theirs (see Uniqueness).

Write: `tools/_work/topik/out-NN.json`

```json
{
  "1-core-01": {
    "words": {
      "것": {
        "rom": "geot",
        "lo": "ສິ່ງ, ອັນ", "th": "สิ่ง, อัน", "vi": "cái, điều, thứ", "mn": "зүйл", "ar": "شيء",
        "emoji": "📦",
        "ex": { "ko": "이 것은 제 거예요.", "rom": "i geoseun je geoyeyo.", "lo": "…", "th": "…", "vi": "…", "mn": "…", "ar": "…" }
      }
    },
    "phrases": [
      { "ko": "그건 제 것이 아니에요.", "rom": "geugeon je geosi anieyo.", "lo": "…", "th": "…", "vi": "…", "mn": "…", "ar": "…", "emoji": "🙅" }
    ]
  }
}
```

- The unit key is `"<level>-<key>"`, for example `"1-core-01"`.
- `words` has one entry for every `"new"` word of that unit, and nothing else.
- `phrases` has exactly 5 entries.

Write the JSON with a script or in pieces if easier. The final file must be valid JSON.

## Rules

### Meanings (`lo` · `th` · `vi` · `mn` · `ar`)

- Short, natural, dictionary-style meaning of the **main sense** a TOPIK beginner or intermediate learner needs. Use `pos`, `orig` and `senses` to pick the sense.
  - When two senses are both very common, give at most two, separated by `, `.
- Verbs and adjectives in each language's plain dictionary form.
  - Lao/Thai: verb or adjective without a subject.
  - Vietnamese: lowercase.
  - Mongolian: dictionary form ending in -х.
  - Arabic: past 3rd person masculine or masdar, whichever a dictionary gives.
- **Grammar words** (`의`, `보`, `관`, and words like 그/이/저):
  - Give the function plus a short cue in brackets.
  - Examples: 수 → "way, possibility (-ㄹ 수 있다 = can)"; 것 → "thing, the fact that"; 않다 → "not (-지 않다)"; 두 → "two (before a counter)"; 한 → "one (before a counter); about".
  - Write the cue in the target language. Keep Korean only inside brackets.
- **Correct script only:**
  - `lo`: Lao script
  - `th`: Thai script
  - `vi`: Vietnamese with diacritics
  - `mn`: Mongolian Cyrillic
  - `ar`: Arabic script
  - No Hangul outside brackets.

### `rom`

- Revised Romanization **as pronounced**, lowercase, spaces between words.
  - Examples: 심각하다 → simgakada, 같이 → gachi, 좋다 → jota, 없다 → eopda, 읽다 → ikda.
- The same applies to `ex.rom` and to the phrases' `rom`.

### Emoji

- **One** emoji that suggests the meaning. For abstract or grammar words, pick the closest sensible symbol.
- Emoji 13.0 or older only. Never use these: 🫠🫢🫣🫡🫥🫤🥹🫱🫲🫳🫴🫰🫵🫶🪸🪷🪹🪺🫘🫗🫙🛝🛞🛟🪬🪩🪫🩼🩻🫧🪪🟰🫨🩷🩵🩶🫏🪿🫎🪼🪽🪮🪭🫚🫛🪯🛜🪇🪈🫩🫆🪾🫜🪉🪏🫟🔞
- No national flags, unless the word is a country.

### Uniqueness (inside one unit)

These are quiz options, so they must look different.

- No two words or phrases may share the same emoji.
- No two words may have the same `lo`, `th` or `vi` meaning text.
- This includes the given `"reuse"` / `"moved"` words.
- Near-synonyms must be told apart. 것 vs 거 → "thing" vs "thing (casual, = 것)".

### Example `ex`

- One natural, short Korean sentence in 해요체 that uses the word. Conjugated is fine.
- Aim for 10–25 characters; the maximum is 60.
- Level-appropriate:
  - Level 1–2: everyday beginner Korean.
  - Level 3–5: natural intermediate Korean.
- Translate faithfully into all five languages.
- Original sentences only. Do not copy textbooks or exams.

### Phrases (5 per unit)

- Short, useful everyday sentences. Each one uses **at least one word of this unit**, ideally a new one.
- Two or more words (eojeol). 해요체 or polite form.
- All five should differ from each other in situation and grammar.
- Each phrase has `rom`, all five translations, and its own emoji. The emoji must be unique in the unit, so it cannot repeat any word's emoji either.

### Quality

- Natural Korean, and natural translations a native speaker would say.
- No real people or brands, and nothing sensitive.

## Validate (must pass), then report

Run from the repository root:

```
node tools/topik/check.mjs NN
```

- **✗ = error:** fix every one.
- **△ = warning:** review it and fix it when it is a real problem.

Final report, under 120 words:
- the validator line;
- anything doubtful (unclear senses, grammar words, translations you are unsure of).
