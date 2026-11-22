// 라오 글자 → 음절 · 로마자 · 한글 발음 (라오스어판: 한국인이 라오스어를 배울 때 읽는 법)
// 음절 나누기: LaoNLP syllable_tokenize (Apache-2.0, Wannaphong Phatthiyaphaibun) — PHISSAMAY et al.
//   "Syllabification of Lao Script for Line Breaking" 의 정규식을 TypeScript 로 옮김
// 로마자·한글은 음절마다 첫소리 · 모음 · 끝소리를 읽어 만든 근사값 (성조는 표시하지 않음)

const TONE = '່້໊໋'
const CONS = 'ກຂຄງຈສຊຍດຕຖທນບປຜຝພຟມຢຣລວຫອຮໜໝ'

// ── 음절 나누기 (LaoNLP 정규식) ──
const x = `[${CONS}]`
const x2 = '[ຼຣວລ]'
const x5 = `[${TONE}]`
const x8 = '[ກງຍດນມຢບວ]'
const x8s = '[ຍດນມຢບ]'
const x9a = '(?:[ຈສຊພຟລ]໌)'
const re1 = `ເຫ?${x}${x2}?(?:${x5}?${x8}?${x9a}?|[ິີ]${x5}?${x8}?${x9a}?|[ຶື]${x5}?ອ${x8}?${x9a}?|າ?ະ|ົ${x5}?າ|ັ${x5}?${x8}${x9a}?|ັ?${x5}?ຽ)`
const re2 = `ແຫ?${x}${x2}?(?:${x5}?[ວອຽ]?${x8}?${x9a}?|ະ|ັ${x5}?${x8}${x9a}?)`
const re3 = `ໂຫ?${x}${x2}?(?:${x5}?${x8}?${x9a}?|ະ|ັ${x5}?${x8s}?)`
const re4 = `ໄຫ?${x}${x2}?${x5}?ວ?${x9a}?`
const re5 = `ໃຫ?${x}${x2}?${x5}?ວ?`
const re6 = `ຫ?${x}${x2}?[ຸູ]${x5}?${x8}?${x9a}?`
const re7 = `ຫ?${x}${x2}?[ິີຶື]${x5}?${x8}?${x9a}?`
const re8 = `ຫ?${x}${x2}?ໍ${x5}?າ?${x9a}?`
const re9 = `ຫ?${x}${x2}?ົ${x5}?(?:${x8}${x9a}?|ວະ)`
const re10 = `ຫ?${x}${x2}?ັ${x5}?ວ?${x8}${x9a}?`
const re11 = `ຫ?${x}${x2}?${x5}?[ວອຽ]${x8}${x9a}?`
const re12 = `ຫ?${x}${x2}?${x5}?ະ`
const re13 = `ຫ?${x}${x2}?${x5}?າ${x8}?${x9a}?`
const re14 = `ຫ?${x}${x2}?${x5}?ຳ${x9a}?`
const NUM = '[໐-໙]'
const BASIC = `(?:(?:${[re1, re2, re3, re4, re5, re6, re7, re8, re9, re10, re11, re12, re13, re14].map((r) => `(?:${r})`).join('|')})[ຯໆ]?|${NUM}+)`
const LOOK = `(?:${[re6, re7, re8, re9, re10, re11, re12, re13, re14, `${NUM}+`].join('|')})`
const SYL = new RegExp(`${BASIC}(?=[ເແໂໄໃຫ]|\\s|[^\\u0E80-\\u0EFF]|$|${LOOK})`, 'g')

/** 옛 철자·입력 순서 차이를 맞춤: ຫນ→ໜ, ຫມ→ໝ, ໍາ→ຳ, 성조 부호 뒤로 */
export function laoNormalize(s: string): string {
  return s
    .normalize('NFC')
    .replace(/​/g, '')
    .replace(/ຫນ/g, 'ໜ')
    .replace(/ຫມ/g, 'ໝ')
    .replace(/ໍາ/g, 'ຳ')
    .replace(new RegExp(`([${CONS}])([${TONE}])([ັິ-ູົໍ])`, 'g'), '$1$3$2')
}

export function laoSyllables(text: string): string[] {
  const s = laoNormalize(text)
  const out: string[] = []
  let last = 0
  for (const m of s.matchAll(SYL)) {
    // 정규식에 안 걸린 글자도 버리지 않음 (그 앞 음절에 붙임)
    if (m.index! > last && out.length) out[out.length - 1] += s.slice(last, m.index)
    // ໂທລະ · ເວລາ 처럼 정규식이 ລ/ຣ 를 겹자음으로 붙인 경우 → ໂທ + ລະ
    const sp = /^([ເແໂ][ກ-ຮໜໝ])([ລຣ]ະ)$/.exec(m[0])
    if (sp) out.push(sp[1], sp[2])
    else out.push(m[0])
    last = m.index! + m[0].length
  }
  if (last < s.length && out.length) out[out.length - 1] += s.slice(last)
  if (!out.length && s.trim()) out.push(s.trim())
  return out
}

// ── 한 음절 읽기 ──
type V = 'a' | 'i' | 'ue' | 'u' | 'e' | 'ae' | 'o' | 'oe'
interface Syl {
  init: string // 로마자 첫소리 ('' = 성문음 ອ)
  glide: '' | 'y' | 'w'
  vowels: V[] // 이중모음은 여러 개 (ia → i, a)
  fin: string // k ng t n p m · 또는 '' (반모음 끝은 vowels 에 넣음)
}

const INIT: Record<string, string> = {
  ກ: 'k', ຂ: 'kh', ຄ: 'kh', ງ: 'ng', ຈ: 'ch', ສ: 's', ຊ: 's', ຍ: 'ny', ດ: 'd', ຕ: 't', ຖ: 'th', ທ: 'th', ນ: 'n', ບ: 'b', ປ: 'p', ຜ: 'ph',
  ຝ: 'f', ພ: 'ph', ຟ: 'f', ມ: 'm', ຢ: 'y', ຣ: 'r', ລ: 'l', ວ: 'v', ຫ: 'h', ອ: '', ຮ: 'h', ໜ: 'n', ໝ: 'm',
}
const FIN: Record<string, string> = { ກ: 'k', ງ: 'ng', ດ: 't', ນ: 'n', ບ: 'p', ມ: 'm', ຢ: 'i', ຍ: 'i', ວ: 'o' }
const SONORANT = 'ງຍນມລວຣ'

function parse(syl: string): Syl | null {
  let s = syl.replace(new RegExp(`[${TONE}]`, 'g'), '').replace(/[^຀-໿]/g, '')
  s = s.replace(/[ຈສຊພຟລ]໌/g, '') // 외래어 끝소리(취소 부호) 생략
  s = s.replace(/[ຯໆ]/g, '')
  if (!s) return null
  let i = 0
  const lead = 'ເແໂໄໃ'.includes(s[0]) ? s[i++] : ''
  // ຫຼ = l (ຫ 는 소리 없음) · ຫ + 울림소리(ງ ຍ ນ ມ ລ ວ ຣ) 도 ຫ 는 소리 없음
  if (s[i] === 'ຫ' && s[i + 1] === 'ຼ') s = s.slice(0, i) + 'ລ' + s.slice(i + 2)
  else if (s[i] === 'ຫ' && s[i + 1] && SONORANT.includes(s[i + 1])) i++
  let c = s[i++]
  if (!c || !(c in INIT)) return null
  let init = INIT[c]
  let glide: Syl['glide'] = ''
  if (s[i] === 'ຼ') {
    // 아래 ລ (ຫຼ = l)
    init = init === 'h' || init === '' ? 'l' : init + 'l'
    i++
  }
  let rest = s.slice(i)
  // ກວ + 모음 표시 = kw (ກວາງ) / ກວ + 끝소리·끝 = kua (ກວດ, ຕົວ 는 ົວ)
  if (rest[0] === 'ວ' && /^ວ[າະິີັຳຽເ]/.test(rest)) {
    glide = 'w'
    rest = rest.slice(1)
  } else if ((rest[0] === 'ລ' || rest[0] === 'ຣ') && /^[ລຣ][າະິີ]/.test(rest) && 'ກຂຄປພຜບ'.includes(c)) {
    init += 'l'
    rest = rest.slice(1)
  }
  if (init === 'ny') {
    // ຍ: 처음 소리는 ny (냐), 한글은 y 로 읽힘
  }
  let vowels: V[] = []
  let fin = ''
  const tail = (r: string) => {
    if (!r) return
    const f = FIN[r[0]]
    if (f === 'i') vowels.push('i')
    else if (f === 'o') vowels.push(vowels.length && vowels[vowels.length - 1] === 'i' ? 'u' : 'o')
    else if (f) fin = f
  }
  const take = (p: string) => (rest.startsWith(p) ? ((rest = rest.slice(p.length)), true) : false)
  if (lead === 'ເ') {
    if (take('ົາ')) vowels = ['a', 'o']
    else if (take('າະ')) vowels = ['o']
    else if (take('ິ') || take('ີ')) vowels = ['oe']
    else if (take('ືອ') || take('ຶອ')) vowels = ['ue', 'a']
    else if (take('ັຍ') || (rest === 'ຍ' && take('ຍ'))) vowels = ['i', 'a']
    else if (take('ະ') || take('ັ')) vowels = ['e']
    else vowels = ['e']
  } else if (lead === 'ແ') {
    take('ະ') || take('ັ')
    vowels = ['ae']
  } else if (lead === 'ໂ') {
    take('ະ') || take('ັ')
    vowels = ['o']
  } else if (lead === 'ໄ' || lead === 'ໃ') {
    vowels = ['a', 'i']
  } else if (take('ະ') || take('າ')) vowels = ['a']
  else if (take('ຳ')) {
    vowels = ['a']
    fin = 'm'
  } else if (take('ັ')) {
    if (take('ວ')) vowels = ['u', 'a']
    else if (take('ອ')) vowels = ['o'] // ລັອກ (외래어 짧은 o)
    else vowels = ['a']
  } else if (take('ິ') || take('ີ')) vowels = ['i']
  else if (take('ຶ') || take('ື')) {
    take('ອ')
    vowels = ['ue']
  } else if (take('ຸ') || take('ູ')) vowels = ['u']
  else if (take('ົວ')) vowels = ['u', 'a']
  else if (take('ົ')) vowels = ['o']
  else if (take('ໍ')) {
    take('າ')
    vowels = ['o']
  } else if (take('ຽ')) vowels = ['i', 'a']
  else if (rest[0] === 'ອ' && (rest.length === 1 || FIN[rest[1]])) {
    rest = rest.slice(1)
    vowels = ['o']
  } else if (rest[0] === 'ວ' && rest.length >= 1) {
    rest = rest.slice(1)
    vowels = ['u', 'a']
  } else vowels = [rest ? 'o' : 'a']
  tail(rest)
  if (init === 'ny' && fin === '' && vowels[0] === 'i') init = 'ny'
  return { init, glide, vowels, fin }
}

// ── 로마자 ──
function romSyl(p: Syl): string {
  const v = p.vowels.join('').replace('ao', 'ao').replace(/^aeo$/, 'aeo')
  return p.init + (p.glide === 'w' ? 'w' : '') + v + p.fin
}

/** 라오 글자 → 로마자 (예: ສະບາຍດີ → sabaidi) — 띄어쓰기는 유지 */
export function laoRoman(text: string): string {
  return laoNormalize(text)
    .split(/(\s+|[^຀-໿\s]+)/)
    .map((part) => (/[຀-໿]/.test(part) ? laoSyllables(part).map((x) => (parse(x) ? romSyl(parse(x)!) : '')).join('') : part))
    .join('')
}

// ── 한글 ──
const CHO: Record<string, number> = { k: 1, kh: 15, ng: 11, ch: 13, s: 9, ny: 2, d: 3, t: 4, th: 16, n: 2, b: 7, p: 8, ph: 17, f: 17, m: 6, y: 11, r: 5, l: 5, v: 11, h: 18, '': 11 }
const JUNG: Record<V, number> = { a: 0, i: 20, ue: 18, u: 13, e: 5, ae: 1, o: 8, oe: 4 }
const JUNG_Y: Partial<Record<V, number>> = { a: 2, e: 7, ae: 3, o: 12, u: 17, oe: 6, i: 20, ue: 18 }
const JUNG_W: Partial<Record<V, number>> = { a: 9, ae: 10, e: 15, i: 16, oe: 14, o: 14, u: 13, ue: 16 }
const JONG: Record<string, number> = { '': 0, k: 1, ng: 21, t: 19, n: 4, p: 17, m: 16 }
const hangul = (cho: number, jung: number, jong = 0) => String.fromCharCode(0xac00 + (cho * 21 + jung) * 28 + jong)

function hanSyl(p: Syl): string {
  const out: string[] = []
  let init = p.init
  let pre = ''
  // 겹첫소리(kl, pl …): 앞 자음은 '으' 음절로
  if (init.length > 1 && init.endsWith('l') && init !== 'l') {
    const c0 = init.slice(0, -1)
    pre = hangul(CHO[c0] ?? 11, 18)
    init = 'l'
  }
  if (init === 'ng') pre += '응'
  p.vowels.forEach((v, k) => {
    const first = k === 0
    const last = k === p.vowels.length - 1
    let cho = first ? (CHO[init] ?? 11) : 11
    let jung = JUNG[v]
    if (first && (init === 'ny' || init === 'y')) jung = JUNG_Y[v] ?? jung
    if (first && (p.glide === 'w' || init === 'v')) jung = JUNG_W[v] ?? jung
    if (first && init === 'ng') cho = 11
    out.push(hangul(cho, jung, last ? (JONG[p.fin] ?? 0) : 0))
  })
  return pre + out.join('')
}

/** 라오 글자 → 한글 발음 (예: ສະບາຍດີ → 사바이디, ຂອບໃຈ → 콥짜이) */
export function laoHangul(text: string): string {
  return laoNormalize(text)
    .split(/(\s+|[^຀-໿\s]+)/)
    .map((part) => (/[຀-໿]/.test(part) ? laoSyllables(part).map((x) => (parse(x) ? hanSyl(parse(x)!) : '')).join('') : /^\s+$/.test(part) ? ' ' : ` ${part.replace(/[^0-9?!]/g, '')} `))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}
