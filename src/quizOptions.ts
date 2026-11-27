// 문제 보기(오답) 고르기 — 답만 튀어 보이지 않게
// - 같은 종류끼리: 문장 문제는 문장만, 단어 문제는 단어만 (예전에는 단원 전체에서 아무거나 골라 문장 하나만 길어서 답이 보였음)
// - 비슷해 보이는 것 먼저: 글자 조각(2글자) 겹침 + 길이가 비슷한 것, 한국어 단어는 '-다'(동사·형용사)끼리
// - 같은 점수면 섞이도록 약간의 무작위 (매번 같은 오답만 나오지 않게)
export interface OptionCand {
  id: string
  /** 보기에 보이는 글 (뜻 · 한국어 · 그림) */
  key: string
  phrase: boolean
  /** 배울 말 (한국어판은 한국어, 판은 일본어·영어·라오어) — '-다' 판단에 씀 */
  ko: string
}

const norm = (s: string) => s.toLowerCase().replace(/[\s.,!?。、，？！「」『』'"~～…·()（）\-[\]]/g, '')
function grams(s: string): Set<string> {
  const t = norm(s)
  const g = new Set<string>()
  if (t.length < 2) {
    if (t) g.add(t)
    return g
  }
  for (let i = 0; i < t.length - 1; i++) g.add(t.slice(i, i + 2))
  return g
}

/** 0~1: 글자 조각이 많이 겹치고 길이가 비슷할수록 큼 */
export function similarity(a: string, b: string): number {
  const A = grams(a)
  const B = grams(b)
  let inter = 0
  for (const x of A) if (B.has(x)) inter++
  const jac = inter / Math.max(1, A.size + B.size - inter)
  const la = norm(a).length
  const lb = norm(b).length
  const len = 1 - Math.abs(la - lb) / Math.max(la, lb, 1)
  return 0.55 * jac + 0.45 * len
}

const isPredicate = (ko: string) => /다$/.test(ko.trim())

/** 정답과 같은 종류에서 비슷한 순으로 n개 (보기 글이 겹치는 것은 뺌) */
export function pickDistractors<T extends OptionCand>(ans: T, cands: T[], n = 3, rnd: () => number = Math.random, similar = true): T[] {
  const seen = new Set([ans.key])
  const scored = cands
    .filter((c) => c.id !== ans.id && c.phrase === ans.phrase && c.key)
    .map((c) => ({
      c,
      s: (similar ? similarity(ans.key, c.key) + (!ans.phrase && isPredicate(ans.ko) === isPredicate(c.ko) ? 0.15 : 0) : 0) + rnd() * (similar ? 0.2 : 1),
    }))
    .sort((a, b) => b.s - a.s)
  const out: T[] = []
  for (const { c } of scored) {
    if (out.length === n) break
    if (seen.has(c.key)) continue
    seen.add(c.key)
    out.push(c)
  }
  return out
}
