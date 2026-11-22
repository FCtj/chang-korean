// 예시 랭킹에 나오는 사람들 (서버 연결 전 데모용) — 만든 사람의 지인들
// 사진은 얼굴만 작게 자른 128px. 빼 달라는 사람이 있으면 여기서 지우면 됨 (2026-11-22: 태국 지인 4명 요청으로 뺌)
import koytar from '../assets/friends/koytar.jpg'
import nin from '../assets/friends/nin.jpg'
import thony from '../assets/friends/thony.jpg'
import aking from '../assets/friends/aking.jpg'
import loy from '../assets/friends/loy.jpg'
import aoy from '../assets/friends/aoy.jpg'
import khanthala from '../assets/friends/khanthala.jpg'
import kod from '../assets/friends/kod.jpg'
import jana from '../assets/friends/jana.jpg'
import kanokwan from '../assets/friends/kanokwan.jpg'
import bud from '../assets/friends/bud.jpg'

export interface DemoPerson {
  name: string
  avatar: string | null
  country: 'LA' | 'TH' | 'VN'
}

// 순서 = 예시 랭킹 순위: 1등 Koy, 2등 Aoy, 그다음 러이 · 아낑 · 토니, 나머지
// (앱에 실제로 등록한 지인들만. 서버 연결 전 데모용)
export const DEMO_PEOPLE: DemoPerson[] = [
  { name: "Koytar'r Pmj", avatar: koytar, country: 'LA' },
  { name: 'Nong Nam Aoy', avatar: aoy, country: 'LA' },
  { name: 'Loy', avatar: loy, country: 'LA' },
  { name: 'AKING🪶', avatar: aking, country: 'LA' },
  { name: 'Thony', avatar: thony, country: 'LA' },
  { name: 'Kanokwan Mhuenklaew', avatar: kanokwan, country: 'TH' },
  { name: "N'in Vongvijit", avatar: nin, country: 'LA' },
  { name: 'Khanthala Khanbaykham', avatar: khanthala, country: 'LA' },
  { name: 'Kod Chanthamee', avatar: kod, country: 'LA' },
  { name: 'Bud Saba', avatar: bud, country: 'LA' },
  { name: 'Jana Ganjana', avatar: jana, country: 'TH' },
]
