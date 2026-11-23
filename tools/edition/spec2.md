# Fill in Korean meanings and example sentences for a source-based word list

A Korean flash-card app teaches Japanese (JLPT) and English (TOEIC) to Korean adults.

The word lists come from published, frequency-based sources:
- **Japanese:** Jonathan Waller's JLPT N5–N3 lists, ordered by Jiten frequency.
- **English:** the TOEIC Service List 1.2 plus the New General Service List 1.2.

**The words are fixed.** Never add, drop, reorder or respell a word. Your job is to write, for every word, a natural Korean meaning, one emoji and one natural example sentence with a Korean translation.

All paths are under `tools/_work/edition2/`. Do not edit anything under the app source (`src/`).

## Input

Your input is `chunk-<name>.json`, an array of units:

```
{ level, key, title, words: [{ term, reading, hint, draft? }] }
```

- `reading`: the kana reading (Japanese) or the IPA from the CMU dictionary (English). It may be empty for a few English words.
- `hint`
  - **Japanese:** the English gloss from the source list. Your Korean meaning must match this sense.
  - **English:** the source and rank, e.g. `TSL 120` or `NGSL 1534`.
    - **TSL** words are TOEIC-specific, so give the business or TOEIC sense.
    - **NGSL** words are general high-frequency words, so give the most common sense.
- `draft`: an earlier AI draft, present on some words. Reuse it only when it is accurate and natural for this sense, and fix anything awkward. Drafts are not trusted.

## Output

Write `out-<name>.json`: one JSON object keyed by term, covering every word in your chunk.

```
"<term>": {
  "meaning": "…",
  "emoji": "…",
  "ex": "…",
  "exRom": "…",
  "exKo": "…",
  "ipa": "…"
}
```

- `ipa` is for English only, and only when the input `reading` is empty: American IPA without slashes.
- `exRom`
  - **Japanese:** the full kana reading of `ex`.
  - **English:** `""`.

## Meaning rules

- **Short, natural Korean** of the kind a good Korean–Japanese or Korean–English dictionary gives for the main sense. When the word really has two very common senses, give one or two meanings separated by `, `.
- **Japanese**
  - Verbs end in -다 (読む → 읽다).
  - い/な adjectives become Korean adjectives (高い → 비싸다, 높다).
  - Counters and affixes are written like `~장 (얇은 것 세는 말)` or `~씨 (이름 뒤 존칭)`.
  - Never put kana in the meaning.
- **English**
  - Start with the part of speech: `[명]`, `[동]`, `[형]`, `[부]`, `[전]`, `[접]`, `[대]` or `[감]`.
  - When a word is just as commonly used as two parts of speech, write both, as in `[동] 요청하다 · [명] 요청`.
- **Uniqueness:** within one unit, no two words may share the same meaning text or the same emoji. These are quiz options, so they must look different.

## Example rules

The most important quality is naturalness. Write what a native speaker would actually say or write, not textbook translationese.

- **Japanese `ex`**
  - Keep it at 30 characters or fewer when possible. The hard limit is 45.
  - Use the word (conjugated is fine).
  - **Register:**
    - N5/N4: です/ます style with N5/N4 grammar.
    - N3: natural everyday Japanese.
  - **Particles:** use particles that match the hint sense. Examples:
    - 歯 is "tooth", so write 歯を磨きます, not the particle は.
    - 戸 is "door", so write 戸を閉めます.
- **English `ex`**
  - Write 15 words or fewer, starting with a capital letter and ending with `.`, `?` or `!`.
  - **TSL** words get an office, business, travel or customer-service sentence of the kind TOEIC uses.
  - **NGSL** words get an everyday or business sentence.
- **`exKo`:** natural Korean in 해요체 that translates the example faithfully.
- **Originality:** sentences must be original. Do not copy textbooks or past exams.

## Emoji

Pick an emoji that suggests the meaning. For abstract words, choose the closest sensible symbol. National flags only for country words.

## Validate (must pass), then report

```
node tools/_work/edition2/check-chunk.mjs <name>
```

Run it from the repository root.
- Fix every ✗ line.
- △ warnings mean the word may not appear in its example. Fix the ones where it really doesn't; a conjugated form is fine.

Final report, under 80 words:
- the validator line;
- how many drafts you rewrote;
- anything doubtful.
