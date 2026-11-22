// 학습자 나라에 맞춘 자기소개 문장: '저는 라오스 사람이에요' → 몽골이면 '저는 몽골 사람이에요'
// TOPIK 1급 단원의 나라 단어(한국·라오스·태국·베트남)에 몽골이 없어서, 몽골이면 '라오스' 카드를 '몽골' 로
// 단어 id 는 그대로라 진도는 유지됨. App 이 나라가 바뀔 때마다 personalizeCountry 를 부름
import { TRACKS } from './tracks.ts'
import type { Word } from './words.ts'

type Fill = Pick<Word, 'ko' | 'rom' | 'lo' | 'th' | 'vi' | 'mn' | 'emoji'>
type C = 'LA' | 'TH' | 'VN' | 'MN'

const NAME: Record<C, { ko: string; rom: string; romEseo: string; lo: string; th: string; vi: string; viPerson: string; mn: string; mnAdj: string; mnFrom: string; flag: string }> = {
  LA: { ko: '라오스', rom: 'laoseu', romEseo: 'raoseueseo', lo: 'ລາວ', th: 'ลาว', vi: 'Lào', viPerson: 'Lào', mn: 'Лаос', mnAdj: 'лаос', mnFrom: 'Лаосоос', flag: '🇱🇦' },
  TH: { ko: '태국', rom: 'taeguk', romEseo: 'taegugeseo', lo: 'ໄທ', th: 'ไทย', vi: 'Thái Lan', viPerson: 'Thái', mn: 'Тайланд', mnAdj: 'тайланд', mnFrom: 'Тайландаас', flag: '🇹🇭' },
  VN: { ko: '베트남', rom: 'beteunam', romEseo: 'beteunameseo', lo: 'ຫວຽດນາມ', th: 'เวียดนาม', vi: 'Việt Nam', viPerson: 'Việt Nam', mn: 'Вьетнам', mnAdj: 'вьетнам', mnFrom: 'Вьетнамаас', flag: '🇻🇳' },
  MN: { ko: '몽골', rom: 'monggol', romEseo: 'monggoreseo', lo: 'ມົງໂກລີ', th: 'มองโกเลีย', vi: 'Mông Cổ', viPerson: 'Mông Cổ', mn: 'Монгол', mnAdj: 'монгол', mnFrom: 'Монголоос', flag: '🇲🇳' },
}

const person = (n: (typeof NAME)[C]): Fill => ({ ko: `저는 ${n.ko} 사람이에요.`, rom: `jeoneun ${n.rom} saramieyo.`, lo: `ຂ້ອຍເປັນຄົນ${n.lo}`, th: `ฉันเป็นคน${n.th}`, vi: `Tôi là người ${n.viPerson}.`, mn: `Би ${n.mnAdj} хүн.`, emoji: '🙂' })
const from = (n: (typeof NAME)[C]): Fill => ({ ko: `저는 ${n.ko}에서 왔어요.`, rom: `jeoneun ${n.romEseo} wasseoyo.`, lo: `ຂ້ອຍມາຈາກປະເທດ${n.lo}`, th: `ฉันมาจากประเทศ${n.th}`, vi: `Tôi đến từ ${n.vi}.`, mn: `Би ${n.mnFrom} ирсэн.`, emoji: n.flag })

// 원래 문장(라오스) → 나라별로 바꿀 내용
const TARGETS: Partial<Record<string, (c: C) => Fill | null>> = {
  라오스: (c) => (c === 'MN' ? { ko: NAME.MN.ko, rom: NAME.MN.rom, lo: NAME.MN.lo, th: NAME.MN.th, vi: NAME.MN.vi, mn: NAME.MN.mn, emoji: NAME.MN.flag } : null),
  '저는 라오스 사람이에요.': (c) => person(NAME[c]),
  '저는 라오스에서 왔어요.': (c) => from(NAME[c]),
}

let originals: { word: Word; orig: Fill; make: (c: C) => Fill | null }[] | null = null
let applied = ''

export function personalizeCountry(country: string) {
  if (applied === country) return
  applied = country
  if (!originals) {
    originals = []
    for (const t of TRACKS)
      for (const u of t.units)
        for (const w of u.words) {
          const make = TARGETS[w.ko]
          if (make) originals.push({ word: w, orig: { ko: w.ko, rom: w.rom, lo: w.lo, th: w.th, vi: w.vi, mn: w.mn, emoji: w.emoji }, make })
        }
  }
  const c = (['LA', 'TH', 'VN', 'MN'] as const).find((x) => x === country)
  for (const { word, orig, make } of originals) Object.assign(word, (c && make(c)) || orig)
}
