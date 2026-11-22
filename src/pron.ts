// 한국어 발음을 학습자 글자로: 라오 문자 · 태국 문자 · 베트남식 표기 · 몽골 키릴 문자 · 아랍 문자
// 1) 한글을 소리 나는 대로 바꿈 (연음 · 거센소리 · 비음화 · 유음화 · 구개음화 · 받침 대표음)
// 2) 소리 난 음절(첫소리 + 모음 + 받침)을 각 언어 글자 규칙으로 씀
// ⚠️ 규칙으로 만든 근사 표기 — 원어민 검수로 다듬을 수 있음 (각 표의 값만 바꾸면 됨)
import type { Native } from './data/words'

const I_LIST = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
const V_LIST = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ']
const F_LIST = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']

/** 소리 난 음절: 첫소리(없으면 'ㅇ') · 모음 · 받침(대표음 7개 중 하나 또는 '') */
export interface Syl {
  i: string
  v: string
  f: string
}
type Piece = { syl: Syl; wordStart: boolean } | { text: string }

// 겹받침: [남는 것, 넘어가는 것]
const SPLIT: Record<string, [string, string]> = { ㄳ: ['ㄱ', 'ㅅ'], ㄵ: ['ㄴ', 'ㅈ'], ㄶ: ['ㄴ', 'ㅎ'], ㄺ: ['ㄹ', 'ㄱ'], ㄻ: ['ㄹ', 'ㅁ'], ㄼ: ['ㄹ', 'ㅂ'], ㄽ: ['ㄹ', 'ㅅ'], ㄾ: ['ㄹ', 'ㅌ'], ㄿ: ['ㄹ', 'ㅍ'], ㅀ: ['ㄹ', 'ㅎ'], ㅄ: ['ㅂ', 'ㅅ'] }
// 받침 대표음
const REP: Record<string, string> = {
  ㄱ: 'ㄱ', ㄲ: 'ㄱ', ㅋ: 'ㄱ', ㄳ: 'ㄱ', ㄺ: 'ㄱ',
  ㄴ: 'ㄴ', ㄵ: 'ㄴ', ㄶ: 'ㄴ',
  ㄷ: 'ㄷ', ㅅ: 'ㄷ', ㅆ: 'ㄷ', ㅈ: 'ㄷ', ㅊ: 'ㄷ', ㅌ: 'ㄷ', ㅎ: 'ㄷ',
  ㄹ: 'ㄹ', ㄼ: 'ㄹ', ㄽ: 'ㄹ', ㄾ: 'ㄹ', ㅀ: 'ㄹ',
  ㅁ: 'ㅁ', ㄻ: 'ㅁ',
  ㅂ: 'ㅂ', ㅍ: 'ㅂ', ㅄ: 'ㅂ', ㄿ: 'ㅂ',
  ㅇ: 'ㅇ',
}
const ASPIRATE: Record<string, string> = { ㄱ: 'ㅋ', ㄷ: 'ㅌ', ㅂ: 'ㅍ', ㅈ: 'ㅊ', ㅅ: 'ㅆ' }
/** 이중모음(ㅑㅕㅛㅠㅒㅖ) → 단모음: 져·쳐 → 저·처, 셔 → 'ㅅ' 은 '쇼' 처럼 [ɕ] 소리 */
const Y_PLAIN: Record<string, string> = { ㅑ: 'ㅏ', ㅕ: 'ㅓ', ㅛ: 'ㅗ', ㅠ: 'ㅜ', ㅒ: 'ㅐ', ㅖ: 'ㅔ' }

/** 한글 → 소리 난 음절들 (단어 경계 밖에서는 이어 읽지 않음) */
export function sound(text: string): Piece[] {
  const out: Piece[] = []
  // 1) 글자 나누기
  const raw: ({ i: string; v: string; f: string; ws: boolean } | string)[] = []
  let prevHangul = false
  for (const ch of text) {
    const c = ch.codePointAt(0)!
    if (c >= 0xac00 && c <= 0xd7a3) {
      const n = c - 0xac00
      raw.push({ i: I_LIST[Math.floor(n / 588)], v: V_LIST[Math.floor((n % 588) / 28)], f: F_LIST[n % 28], ws: !prevHangul })
      prevHangul = true
    } else {
      raw.push(ch)
      prevHangul = false
    }
  }
  // 2) 이웃한 두 음절 사이 소리 바뀜
  for (let k = 0; k < raw.length; k++) {
    const a = raw[k]
    const b = raw[k + 1]
    if (typeof a === 'string') continue
    if (b && typeof b !== 'string') {
      const F = a.f
      if (F && b.i === 'ㅇ') {
        // 연음
        if (F === 'ㅇ') {
          /* 그대로 */
        } else if (F === 'ㅎ') a.f = ''
        else if (F === 'ㄶ' || F === 'ㅀ') {
          a.f = ''
          b.i = SPLIT[F][0]
        } else if (SPLIT[F]) {
          a.f = SPLIT[F][0]
          b.i = SPLIT[F][1]
        } else {
          a.f = ''
          b.i = F === 'ㄷ' && b.v === 'ㅣ' ? 'ㅈ' : F === 'ㅌ' && b.v === 'ㅣ' ? 'ㅊ' : F
        }
      } else if (F && b.i === 'ㅎ' && ['ㄱ', 'ㄲ', 'ㅋ', 'ㄺ', 'ㄷ', 'ㅅ', 'ㅈ', 'ㅊ', 'ㅌ', 'ㅂ', 'ㅍ', 'ㄼ', 'ㄵ'].includes(F)) {
        // 받침 + ㅎ → 거센소리
        const rest = F === 'ㄺ' || F === 'ㄼ' ? 'ㄹ' : F === 'ㄵ' ? 'ㄴ' : ''
        const base = F === 'ㄺ' ? 'ㄱ' : F === 'ㄼ' ? 'ㅂ' : F === 'ㄵ' ? 'ㅈ' : REP[F] === 'ㄷ' && (F === 'ㅈ' || F === 'ㅊ') ? 'ㅈ' : REP[F]
        b.i = ASPIRATE[base] ?? b.i
        a.f = rest
      } else if ((F === 'ㅎ' || F === 'ㄶ' || F === 'ㅀ') && ASPIRATE[b.i]) {
        // ㅎ 받침 + ㄱㄷㅈㅅ → 거센소리 (좋다 → 조타)
        b.i = ASPIRATE[b.i]
        a.f = F === 'ㄶ' ? 'ㄴ' : F === 'ㅀ' ? 'ㄹ' : ''
      } else if (F === 'ㅎ' && b.i === 'ㄴ') a.f = 'ㄴ'
      // 대표음
      a.f = a.f ? (REP[a.f] ?? a.f) : ''
      // ㄹ 의 비음화 · 유음화 · 비음화
      if (b.i === 'ㄹ' && ['ㅁ', 'ㅇ', 'ㄱ', 'ㅂ'].includes(a.f)) b.i = 'ㄴ'
      if (a.f === 'ㄴ' && b.i === 'ㄹ') a.f = 'ㄹ'
      else if (a.f === 'ㄹ' && b.i === 'ㄴ') b.i = 'ㄹ'
      if (['ㄱ', 'ㄷ', 'ㅂ'].includes(a.f) && (b.i === 'ㄴ' || b.i === 'ㅁ')) a.f = a.f === 'ㄱ' ? 'ㅇ' : a.f === 'ㄷ' ? 'ㄴ' : 'ㅁ'
    } else a.f = a.f ? (REP[a.f] ?? a.f) : ''
  }
  for (const r of raw) {
    if (typeof r === 'string') out.push({ text: r })
    else {
      let v = r.i !== 'ㅇ' && r.v === 'ㅢ' ? 'ㅣ' : r.v
      if (['ㅈ', 'ㅉ', 'ㅊ'].includes(r.i) && Y_PLAIN[v]) v = Y_PLAIN[v] // 져 → 저
      out.push({ syl: { i: r.i, v, f: r.f }, wordStart: r.ws })
    }
  }
  return out
}

// ───────── 언어별 쓰기 ─────────
// 예사소리(ㄱㄷㅂㅈ)는 말 첫머리에서 거세게, 모음·울림소리 뒤에서는 부드럽게 들림 → 위치에 따라 글자를 다르게 고르는 언어도 있음
type Pos = { start: boolean; afterVoiced: boolean; afterL: boolean }
const Y_VOWELS = new Set(['ㅑ', 'ㅒ', 'ㅕ', 'ㅖ', 'ㅛ', 'ㅠ'])

// 태국어: C = 첫 글자, F = 받침 글자
const TH_I = (i: string, p: Pos): string =>
  (({ ㄱ: p.start ? 'ค' : 'ก', ㄲ: 'ก', ㅋ: 'ค', ㄴ: 'น', ㄷ: p.start ? 'ท' : 'ด', ㄸ: 'ต', ㅌ: 'ท', ㄹ: 'ร', ㅁ: 'ม', ㅂ: p.start ? 'พ' : 'บ', ㅃ: 'ป', ㅍ: 'พ', ㅅ: 'ซ', ㅆ: 'ซ', ㅇ: '', ㅈ: p.start ? 'ช' : 'จ', ㅉ: 'จ', ㅊ: 'ช', ㅎ: 'ฮ' }) as Record<string, string>)[i] ?? ''
const TH_F: Record<string, string> = { ㄱ: 'ก', ㄴ: 'น', ㄷ: 'ด', ㄹ: 'ล', ㅁ: 'ม', ㅂ: 'บ', ㅇ: 'ง' }
// [열린 음절, 닫힌 음절] — C 자리, F 자리
const TH_V: Record<string, [string, string]> = {
  ㅏ: ['Cา', 'CัF'], ㅓ: ['Cอ', 'CอF'], ㅗ: ['โC', 'โCF'], ㅜ: ['Cู', 'CุF'], ㅡ: ['Cือ', 'CึF'], ㅣ: ['Cี', 'CิF'], ㅐ: ['แC', 'แCF'], ㅔ: ['เC', 'เCF'],
  ㅑ: ['Cยา', 'CยัF'], ㅕ: ['Cยอ', 'CยอF'], ㅛ: ['Cโย', 'CโยF'], ㅠ: ['Cยู', 'CยุF'], ㅒ: ['Cเย', 'CเยF'], ㅖ: ['Cเย', 'CเยF'],
  ㅘ: ['Cวา', 'CวัF'], ㅙ: ['แCว', 'แCวF'], ㅚ: ['เCว', 'เCวF'], ㅞ: ['เCว', 'เCวF'], ㅝ: ['Cวอ', 'CวอF'], ㅟ: ['Cวี', 'CวิF'], ㅢ: ['Cึย', 'Cึย'],
}
function th(s: Syl, p: Pos): string {
  const glide = Y_VOWELS.has(s.v) || ['ㅘ', 'ㅙ', 'ㅚ', 'ㅞ', 'ㅝ', 'ㅟ'].includes(s.v)
  if ((s.i === 'ㅅ' || s.i === 'ㅆ') && Y_PLAIN[s.v]) return th({ i: 'ㅊ', v: Y_PLAIN[s.v], f: s.f }, p) // 셔 → ชอ
  let C = s.i === 'ㄹ' && p.afterL ? 'ล' : TH_I(s.i, p)
  if (!C) C = glide ? '' : 'อ'
  const [open, closed] = TH_V[s.v]
  return (s.f ? closed : open).replace('C', C).replace('F', TH_F[s.f] ?? '')
}

// 라오어
const LO_I = (i: string, p: Pos): string =>
  (({ ㄱ: p.start ? 'ຄ' : 'ກ', ㄲ: 'ກ', ㅋ: 'ຄ', ㄴ: 'ນ', ㄷ: p.start ? 'ທ' : 'ດ', ㄸ: 'ຕ', ㅌ: 'ທ', ㄹ: 'ລ', ㅁ: 'ມ', ㅂ: p.start ? 'ພ' : 'ບ', ㅃ: 'ປ', ㅍ: 'ພ', ㅅ: 'ຊ', ㅆ: 'ຊ', ㅇ: '', ㅈ: 'ຈ', ㅉ: 'ຈ', ㅊ: 'ຊ', ㅎ: 'ຮ' }) as Record<string, string>)[i] ?? ''
const LO_F: Record<string, string> = { ㄱ: 'ກ', ㄴ: 'ນ', ㄷ: 'ດ', ㄹ: 'ລ', ㅁ: 'ມ', ㅂ: 'ບ', ㅇ: 'ງ' }
const LO_V: Record<string, [string, string]> = {
  ㅏ: ['Cາ', 'CັF'], ㅓ: ['Cໍ', 'CອF'], ㅗ: ['ໂC', 'CົF'], ㅜ: ['Cູ', 'CຸF'], ㅡ: ['Cື', 'CຶF'], ㅣ: ['Cີ', 'CິF'], ㅐ: ['ແC', 'ແCF'], ㅔ: ['ເC', 'ເCF'],
  ㅑ: ['Cຢາ', 'CຢັF'], ㅕ: ['Cຢໍ', 'CຢອF'], ㅛ: ['CໂຢF', 'CໂຢF'], ㅠ: ['Cຢູ', 'CຢຸF'], ㅒ: ['Cເຢ', 'CເຢF'], ㅖ: ['Cເຢ', 'CເຢF'],
  ㅘ: ['Cວາ', 'CວັF'], ㅙ: ['ແCວ', 'ແCວF'], ㅚ: ['ເCວ', 'ເCວF'], ㅞ: ['ເCວ', 'ເCວF'], ㅝ: ['Cວໍ', 'CວອF'], ㅟ: ['Cວີ', 'CວິF'], ㅢ: ['Cຶຍ', 'Cຶຍ'],
}
function lo(s: Syl, p: Pos): string {
  const yv = Y_VOWELS.has(s.v)
  const glide = yv || ['ㅘ', 'ㅙ', 'ㅚ', 'ㅞ', 'ㅝ', 'ㅟ'].includes(s.v)
  // ㄴ + 이중모음(ㅑㅕㅛㅠ) → ຍ (녕 → ຍອງ)
  if ((s.i === 'ㅅ' || s.i === 'ㅆ') && yv) return lo1('ຊ', Y_PLAIN[s.v], s.f) // 셔 → ຊໍ
  if (s.i === 'ㄴ' && yv) {
    const plain = ({ ㅑ: 'ㅏ', ㅕ: 'ㅓ', ㅛ: 'ㅗ', ㅠ: 'ㅜ', ㅒ: 'ㅐ', ㅖ: 'ㅔ' } as Record<string, string>)[s.v]
    return lo1('ຍ', plain, s.f)
  }
  let C = LO_I(s.i, p)
  if (!C) C = glide ? '' : 'ອ'
  return lo1(C, s.v, s.f)
}
function lo1(C: string, v: string, f: string): string {
  if (v === 'ㅏ' && f === 'ㅁ') return `${C}ຳ` // -am → ຳ
  const [open, closed] = LO_V[v]
  return (f ? closed : open).replace('C', C).replace('F', LO_F[f] ?? '')
}

// 베트남어 (라틴 글자, 베트남 철자 규칙): 음절은 '-', 단어는 띄어 씀
const VI_V: Record<string, string> = {
  ㅏ: 'a', ㅓ: 'ơ', ㅗ: 'ô', ㅜ: 'u', ㅡ: 'ư', ㅣ: 'i', ㅐ: 'e', ㅔ: 'ê', ㅑ: 'ya', ㅕ: 'yơ', ㅛ: 'yô', ㅠ: 'yu', ㅒ: 'ye', ㅖ: 'yê',
  ㅘ: 'oa', ㅙ: 'oe', ㅚ: 'uê', ㅞ: 'uê', ㅝ: 'uơ', ㅟ: 'uy', ㅢ: 'ưi',
}
const VI_F: Record<string, string> = { ㄱ: 'c', ㄴ: 'n', ㄷ: 't', ㄹ: 'l', ㅁ: 'm', ㅂ: 'p', ㅇ: 'ng' }
const W_VOWELS = new Set(['ㅘ', 'ㅙ', 'ㅚ', 'ㅞ', 'ㅝ', 'ㅟ'])
function vi(s: Syl, p: Pos): string {
  let v = VI_V[s.v]
  let C: string
  if (s.i === 'ㄴ' && Y_VOWELS.has(s.v)) {
    C = 'nh'
    v = v.slice(1)
  } else if ((s.i === 'ㅅ' || s.i === 'ㅆ') && Y_VOWELS.has(s.v)) {
    C = 's' // 셔 → sơ
    v = v.slice(1)
  } else if ((s.i === 'ㄱ' || s.i === 'ㄲ') && W_VOWELS.has(s.v)) {
    C = 'qu' // ㄱ + 와/왜/외/워/위 → qua, que, quê, quơ, quy
    v = v.slice(1)
  } else if (s.i === 'ㄱ' || s.i === 'ㄲ') C = /^[eêiy]/.test(v) ? 'k' : 'c'
  else if (s.i === 'ㄹ' && p.afterL) C = 'l'
  else C = ({ ㅋ: 'kh', ㄴ: 'n', ㄷ: 'đ', ㄸ: 't', ㅌ: 'th', ㄹ: 'r', ㅁ: 'm', ㅂ: 'b', ㅃ: 'p', ㅍ: 'ph', ㅅ: 's', ㅆ: 's', ㅇ: '', ㅈ: 'ch', ㅉ: 'ch', ㅊ: 'ch', ㅎ: 'h' } as Record<string, string>)[s.i] ?? ''
  return C + v + (VI_F[s.f] ?? '')
}

// 몽골어 (키릴 문자)
const MN_V: Record<string, string> = {
  ㅏ: 'а', ㅓ: 'ө', ㅗ: 'о', ㅜ: 'у', ㅡ: 'ы', ㅣ: 'и', ㅐ: 'э', ㅔ: 'э', ㅑ: 'я', ㅕ: 'ё', ㅛ: 'ё', ㅠ: 'ю', ㅒ: 'е', ㅖ: 'е',
  ㅘ: 'уа', ㅙ: 'уэ', ㅚ: 'вэ', ㅞ: 'уэ', ㅝ: 'уө', ㅟ: 'ви', ㅢ: 'ый',
}
const MN_F: Record<string, string> = { ㄱ: 'к', ㄴ: 'н', ㄷ: 'т', ㄹ: 'л', ㅁ: 'м', ㅂ: 'п', ㅇ: 'н' }
function mn(s: Syl, p: Pos): string {
  const soft = !p.start && p.afterVoiced
  const C =
    ({ ㄱ: soft ? 'г' : 'к', ㄲ: 'к', ㅋ: 'к', ㄴ: 'н', ㄷ: soft ? 'д' : 'т', ㄸ: 'т', ㅌ: 'т', ㄹ: p.afterL ? 'л' : 'р', ㅁ: 'м', ㅂ: soft ? 'б' : 'п', ㅃ: 'п', ㅍ: 'п', ㅅ: 'с', ㅆ: 'с', ㅇ: '', ㅈ: soft ? 'ж' : 'ч', ㅉ: 'ч', ㅊ: 'ч', ㅎ: 'х' } as Record<string, string>)[s.i] ?? ''
  if ((s.i === 'ㅅ' || s.i === 'ㅆ') && Y_PLAIN[s.v]) return 'ш' + MN_V[Y_PLAIN[s.v]] + (MN_F[s.f] ?? '') // 셔 → шө
  let v = MN_V[s.v]
  // 자음 + я/ё/ю/е 는 그대로 (нё, бя …)
  if (!C && s.v === 'ㅢ') v = 'ый'
  return C + v + (MN_F[s.f] ?? '')
}

// 아랍어 (아랍 문자, 오른쪽→왼쪽): 모음은 장모음 글자(ا و ي)로, ㅡ 는 짧게(글자 없이)
const AR_V: Record<string, string> = {
  ㅏ: 'ا', ㅓ: 'و', ㅗ: 'و', ㅜ: 'و', ㅡ: '', ㅣ: 'ي', ㅐ: 'اي', ㅔ: 'ي', ㅑ: 'يا', ㅕ: 'يو', ㅛ: 'يو', ㅠ: 'يو', ㅒ: 'يي', ㅖ: 'يي',
  ㅘ: 'وا', ㅙ: 'وي', ㅚ: 'وي', ㅞ: 'وي', ㅝ: 'وو', ㅟ: 'وي', ㅢ: 'ئي',
}
// 말 첫머리의 모음 (첫소리 ㅇ): 함자를 얹어서
const AR_V0: Record<string, string> = { ㅏ: 'أ', ㅓ: 'أو', ㅗ: 'أو', ㅜ: 'أو', ㅡ: 'إ', ㅣ: 'إي', ㅐ: 'أي', ㅔ: 'إي', ㅢ: 'إي' }
const AR_F: Record<string, string> = { ㄱ: 'ك', ㄴ: 'ن', ㄷ: 'ت', ㄹ: 'ل', ㅁ: 'م', ㅂ: 'ب', ㅇ: 'نغ' }
function ar(s: Syl, p: Pos): string {
  const soft = !p.start && p.afterVoiced
  let v = AR_V[s.v]
  if ((s.i === 'ㅅ' || s.i === 'ㅆ') && Y_PLAIN[s.v]) return 'ش' + AR_V[Y_PLAIN[s.v]] + (AR_F[s.f] ?? '') // 셔 → شو
  let C =
    ({ ㄱ: 'ك', ㄲ: 'ك', ㅋ: 'ك', ㄴ: 'ن', ㄷ: soft ? 'د' : 'ت', ㄸ: 'ت', ㅌ: 'ت', ㄹ: p.afterL ? 'ل' : 'ر', ㅁ: 'م', ㅂ: 'ب', ㅃ: 'ب', ㅍ: 'ب', ㅅ: 'س', ㅆ: 'س', ㅇ: '', ㅈ: 'ج', ㅉ: 'ج', ㅊ: 'تش', ㅎ: 'ه' } as Record<string, string>)[s.i] ?? ''
  if (!C) {
    if (p.start && AR_V0[s.v]) {
      C = ''
      v = AR_V0[s.v]
    } else if (s.v === 'ㅡ') v = 'ئ'
  }
  return C + v + (AR_F[s.f] ?? '')
}

const cache = new Map<string, string>()
/** 한국어 → 학습자 글자 발음 */
export function localPron(ko: string, n: Native): string {
  const key = n + '\u0000' + ko
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const pieces = sound(ko)
  let out = ''
  let prev: Syl | null = null
  for (const pc of pieces) {
    if ('text' in pc) {
      out += pc.text
      prev = null
      continue
    }
    const s = pc.syl
    const p: Pos = { start: pc.wordStart || !prev, afterVoiced: !prev || prev.f === '' || ['ㄴ', 'ㄹ', 'ㅁ', 'ㅇ'].includes(prev.f), afterL: prev?.f === 'ㄹ' }
    const part = n === 'th' ? th(s, p) : n === 'lo' ? lo(s, p) : n === 'vi' ? vi(s, p) : n === 'ar' ? ar(s, p) : mn(s, p)
    out += n === 'vi' && prev ? '-' + part : part
    prev = s
  }
  cache.set(key, out)
  return out
}
