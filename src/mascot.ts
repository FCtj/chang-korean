// 나라별 마스코트: 라오스·태국(·기타) = 코끼리 · 베트남 = 물소 · 몽골 = 말 · 레바논 = 줄무늬 하이에나(나라 동물)
// 그림(ui.tsx 의 Elephant)·계급 이름·코스 아이콘이 모두 이 값을 따라감
import type { L10n, Tier } from './data/words'
import { TITLE_MN } from './data/tr-mn'
import { TITLE_AR } from './data/tr-ar'

export type MascotKind = 'elephant' | 'buffalo' | 'horse' | 'hyena'

export const mascotOf = (country: string): MascotKind => (country === 'VN' ? 'buffalo' : country === 'MN' ? 'horse' : country === 'LB' ? 'hyena' : 'elephant')

// 하이에나 이모지는 없어서 발자국
export const MASCOT_EMOJI: Record<MascotKind, string> = { elephant: '🐘', buffalo: '🐃', horse: '🐎', hyena: '🐾' }

const l = (ko: string, lo: string, th: string, vi: string, mn?: string): L10n => ({ ko, lo, th, vi, mn: mn || TITLE_MN[ko] || ko, ar: TITLE_AR[ko] || ko })

/** 계급 이름 (코끼리는 words.ts 의 원래 이름) */
const TIER_NAMES: Record<Exclude<MascotKind, 'elephant'>, L10n[]> = {
  buffalo: [
    l('아기 물소', 'ລູກຄວາຍ', 'ลูกกระบือ', 'Nghé con'),
    l('꼬마 물소', 'ຄວາຍນ້ອຍ', 'กระบือน้อย', 'Trâu nhỏ'),
    l('청년 물소', 'ຄວາຍໜຸ່ມ', 'กระบือหนุ่ม', 'Trâu thanh niên'),
    l('대장 물소', 'ຄວາຍຫົວໜ້າຝູງ', 'กระบือจ่าฝูง', 'Trâu đầu đàn'),
    l('왕 물소', 'ພະຍາຄວາຍ', 'พญากระบือ', 'Vua trâu'),
  ],
  horse: [
    l('망아지', 'ລູກມ້າ', 'ลูกม้า', 'Ngựa con'),
    l('꼬마 말', 'ມ້ານ້ອຍ', 'ม้าน้อย', 'Ngựa nhỏ'),
    l('청년 말', 'ມ້າໜຸ່ມ', 'ม้าหนุ่ม', 'Ngựa thanh niên'),
    l('대장 말', 'ມ້າຫົວໜ້າຝູງ', 'ม้าจ่าฝูง', 'Ngựa đầu đàn'),
    l('천리마', 'ມ້າພັນລີ້', 'ม้าพันลี้', 'Thiên lý mã'),
  ],
  hyena: [
    l('아기 하이에나', 'ລູກໄຮອີນາ', 'ลูกไฮยีนา', 'Linh cẩu con', 'Нялх хиртэн'),
    l('꼬마 하이에나', 'ໄຮອີນານ້ອຍ', 'ไฮยีนาน้อย', 'Linh cẩu nhỏ', 'Бяцхан хиртэн'),
    l('청년 하이에나', 'ໄຮອີນາໜຸ່ມ', 'ไฮยีนาหนุ่ม', 'Linh cẩu thanh niên', 'Залуу хиртэн'),
    l('대장 하이에나', 'ໄຮອີນາຫົວໜ້າຝູງ', 'ไฮยีนาจ่าฝูง', 'Linh cẩu đầu đàn', 'Сүргийн тэргүүн хиртэн'),
    l('왕 하이에나', 'ພະຍາໄຮອີນາ', 'พญาไฮยีนา', 'Vua linh cẩu', 'Хиртэн хаан'),
  ],
}

export function tierName(tier: Pick<Tier, 'no' | 'name'> | undefined, kind: MascotKind): L10n | undefined {
  if (!tier) return undefined
  if (kind === 'elephant') return tier.name
  return TIER_NAMES[kind][tier.no - 1] ?? tier.name
}
