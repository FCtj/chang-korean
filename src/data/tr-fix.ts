// 검수로 고친 뜻: 단어 id → 언어별 뜻 (원본 표를 고치지 않고 이 값으로 덮어씀)
// - 동음이의어: 몽골어·아랍어 뜻은 한국어 글자 하나에 하나라서(tr-mn / tr-ar), 단원마다 뜻이 다른 단어는 여기서 그 단원 뜻으로
// - 표본 검수(라오·태국·베트남·몽골·아랍어)에서 고친 뜻
// 단어 id 는 '<단원 id>-<번호>' (예: t-topik-1-numbers-03, r1-07)
type Native = 'lo' | 'th' | 'vi' | 'mn' | 'ar'

export const FIX: Record<string, Partial<Record<Native, string>>> = {}

/** 검수로 고친 뜻 덮어쓰기 */
export function withFix<T extends { id: string }>(w: T): T {
  const f = FIX[w.id]
  return f ? { ...w, ...f } : w
}
