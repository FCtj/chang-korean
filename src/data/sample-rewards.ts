// 테스트 기간 예시: 지인 15명의 포인트 교환 내역 (config.ts 의 SAMPLE_DATA 로 켜고 끔)
// 시간은 '지금으로부터 몇 시간 전' — 언제 열어도 최근처럼 보임. 화면에는 '예시' 표시가 붙음
import { DEMO_PEOPLE, type DemoPerson } from './friends'
import { SHOP, type ShopItem } from './shop'

export interface SampleRedemption {
  person: DemoPerson
  item: ShopItem
  hoursAgo: number
}

// [사람 순서(DEMO_PEOPLE), 상품, 몇 시간 전]
const PLAN: [number, ShopItem['id'], number][] = [
  [0, 'chicken', 2], // Koy 🍗
  [1, 'coffee', 5], // Aoy ☕
  [2, 'giftcard', 9], // Loy 💳
  [3, 'coffee', 20], // Aking ☕
  [4, 'pizza', 27], // Thony 🍕
  [5, 'coffee', 33],
  [6, 'chicken', 46],
  [7, 'coffee', 52],
  [8, 'coffee', 71],
  [9, 'giftcard', 80],
  [10, 'coffee', 98],
  [11, 'chicken', 119],
  [12, 'coffee', 140],
  [13, 'pizza', 166],
  [14, 'coffee', 190],
]

export const SAMPLE_REDEMPTIONS: SampleRedemption[] = PLAN.flatMap(([i, id, hoursAgo]) => {
  const person = DEMO_PEOPLE[i]
  const item = SHOP.find((x) => x.id === id)
  return person && item ? [{ person, item, hoursAgo }] : []
})
