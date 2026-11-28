// 📚 관리자가 '제외'한 카드 id — 앱은 이 카드를 단원에서 빼고 보여 줌
// 서버(excluded_words)에서 받아 이 기기에 저장 → 다음에 앱을 열 때 단원을 만들면서 뺌
// (단원은 앱을 열 때 한 번 만들어지므로, 바뀐 목록은 다음 실행부터 반영)
// 노드 검사 스크립트에서도 불러오므로 localStorage 가 없으면 빈 목록
const KEY = 'chang-korean:excluded'

function load(): Set<string> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null
    const arr = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

/** 앱을 열 때 읽은 목록 (이번 실행 동안 단원 만들기에 씀) */
export const EXCLUDED: ReadonlySet<string> = load()

/** 저장된 목록 (서버에서 새로 받았거나 관리자가 방금 바꾼 것 — 다음 실행에 반영) */
export function savedExcluded(): Set<string> {
  return load()
}

export function saveExcluded(ids: Iterable<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...new Set(ids)].sort()))
  } catch {
    /* 저장 못 하는 기기: 이번에는 그대로 */
  }
}

/** 이번 실행에서 읽은 목록과 저장된 목록이 다르면 true (다시 열면 바뀜) */
export function excludedChanged(): boolean {
  const now = load()
  if (now.size !== EXCLUDED.size) return true
  for (const id of now) if (!EXCLUDED.has(id)) return true
  return false
}
