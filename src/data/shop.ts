// 포인트 교환소 (오픈 예정): 품목과 필요한 포인트는 바뀔 수 있음
// 포인트 기준: 외운 단어 +3P · 하루 최대 400P · 졸업시험 +100P · 승급시험 +300P
import type { TitleL10n } from './track-types'

export interface ShopItem {
  id: string
  icon: string
  points: number
  name: TitleL10n
}

export const SHOP: ShopItem[] = [
  { id: 'coffee', icon: '☕', points: 3000, name: { ko: '커피 기프티콘', lo: 'ຄູປອງກາເຟ', th: 'คูปองกาแฟ', vi: 'Phiếu cà phê' } },
  { id: 'giftcard', icon: '💳', points: 10000, name: { ko: '모바일 상품권', lo: 'ບັດຂອງຂວັນມືຖື', th: 'บัตรของขวัญมือถือ', vi: 'Thẻ quà tặng di động' } },
  { id: 'chicken', icon: '🍗', points: 20000, name: { ko: '치킨', lo: 'ໄກ່ທອດ', th: 'ไก่ทอด', vi: 'Gà rán' } },
  { id: 'pizza', icon: '🍕', points: 25000, name: { ko: '피자', lo: 'ພິຊຊ່າ', th: 'พิซซ่า', vi: 'Pizza' } },
]
/** 아직 못 받은 가장 싼 상품 (다음 목표) */
export const nextShopItem = (points: number) => SHOP.find((i) => i.points > points) ?? SHOP[SHOP.length - 1]
