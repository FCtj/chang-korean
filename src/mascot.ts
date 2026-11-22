// 나라별 마스코트: 라오스·태국(·기타) = 코끼리 · 베트남 = 물소 · 몽골 = 말 · 레바논 = 줄무늬 하이에나(나라 동물)
// 그림(ui.tsx 의 Elephant)·코스 아이콘이 이 값을 따라감. 계급 이름·그림은 나라와 상관없이 계급 동물(RANK_ANIMALS)
import type { L10n, Tier } from './data/words'

export type MascotKind = 'elephant' | 'buffalo' | 'horse' | 'hyena'

export const mascotOf = (country: string): MascotKind => (country === 'VN' ? 'buffalo' : country === 'MN' ? 'horse' : country === 'LB' ? 'hyena' : 'elephant')

// 하이에나 이모지는 없어서 발자국
export const MASCOT_EMOJI: Record<MascotKind, string> = { elephant: '🐘', buffalo: '🐃', horse: '🐎', hyena: '🐾' }

/** 계급 동물 (모든 나라 같음): 올라갈수록 귀여움 → 멋짐. 그림은 rankAnimals.tsx */
export const RANK_ANIMALS: { emoji: string; name: L10n }[] = [
  { emoji: '🐣', name: { ko: '아기 병아리', lo: 'ລູກໄກ່ນ້ອຍ', th: 'ลูกเจี๊ยบ', vi: 'Gà con', mn: 'Ангаахай', ar: 'كتكوت صغير' } },
  { emoji: '🐰', name: { ko: '깡총 토끼', lo: 'ກະຕ່າຍນ້ອຍໂດດໆ', th: 'กระต่ายน้อยกระโดด', vi: 'Thỏ con tinh nghịch', mn: 'Үсэрхий туулай', ar: 'أرنب قافز' } },
  { emoji: '🦊', name: { ko: '꾀돌이 여우', lo: 'ໝາຈິ້ງຈອກຫົວໄວ', th: 'จิ้งจอกเจ้าปัญญา', vi: 'Cáo tinh khôn', mn: 'Ухаалаг үнэг', ar: 'ثعلب ذكي' } },
  { emoji: '🐯', name: { ko: '용감한 호랑이', lo: 'ເສືອໃຈກ້າ', th: 'เสือผู้กล้า', vi: 'Hổ dũng mãnh', mn: 'Зоригт бар', ar: 'نمر شجاع' } },
  { emoji: '🐲', name: { ko: '전설의 용', lo: 'ມັງກອນໃນຕຳນານ', th: 'มังกรในตำนาน', vi: 'Rồng huyền thoại', mn: 'Домогт луу', ar: 'تنين أسطوري' } },
]
export const rankEmoji = (no: number) => RANK_ANIMALS[Math.min(5, Math.max(1, no)) - 1].emoji

/** 계급 이름 = 그 계급의 동물 (나라와 상관없이 같음) */
export function tierName(tier: Pick<Tier, 'no' | 'name'> | undefined, _kind?: MascotKind): L10n | undefined {
  if (!tier) return undefined
  return RANK_ANIMALS[tier.no - 1]?.name ?? tier.name
}
