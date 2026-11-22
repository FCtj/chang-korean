// 일본어·영어판 발음 표시
//   일본어: 단어는 '가나 · 한글 발음' (가나로만 쓰는 말은 한글 발음만), 문장은 가나 읽기만 (조사 は·へ 소리 때문에)
//   영어:   단어는 /IPA/, 문장은 표시 없음
import { EDITION } from './edition'
import { ED_PHRASES, ED_READING } from './data/tracks'
import { kanaToHangul } from './kana'
import { laoHangul } from './lao'

export function edPron(term: string): string {
  const r = ED_READING[term]
  if (!r) return ''
  if (EDITION === 'en') return ED_PHRASES.has(term) ? '' : `/${r}/`
  // 라오스어: 단어는 '로마자 · 한글', 문장은 한글 읽기만 (읽기 칸에 한글)
  if (EDITION === 'lo') return ED_PHRASES.has(term) ? r : `${r} · ${laoHangul(term)}`
  if (ED_PHRASES.has(term)) return r !== term ? r : ''
  const h = kanaToHangul(r)
  return r !== term ? `${r} · ${h}` : h
}
