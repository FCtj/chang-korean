// 랭킹·그룹에서 다른 사람에게 보이는 이름·사진 — 원하면 이름 일부·사진을 가림
// 서버(profiles)에는 가린 값만 올라가므로 다른 사람·관리자 화면에도 가린 채로 보임. 내 기기 화면(인사말 등)은 그대로

const graphemes = (s: string): string[] => {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter
  return Seg ? [...new Seg(undefined, { granularity: 'grapheme' }).segment(s)].map((x) => x.segment) : [...s]
}

/** 단어마다 첫 글자(3글자 이상이면 끝 글자도)만 남기고 * 로: "Koytar'r Pmj" → "K******r P*j", "김민수" → "김*수" */
export function maskName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => {
      const g = graphemes(w)
      if (g.length <= 1) return w
      if (g.length === 2) return g[0] + '*'
      return g[0] + '*'.repeat(g.length - 2) + g[g.length - 1]
    })
    .join(' ')
}

export const publicName = (name: string, hide?: boolean) => (hide ? maskName(name) : name)
export const publicAvatar = (src: string | null | undefined, hide?: boolean) => (hide ? null : src || null)
