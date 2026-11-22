// 목적별 트랙: 단원(단어 25 + 상황 문장) 여러 개를 한 목적으로 묶음
// 원본: track-restaurant.ts (🍜 한국 식당·가게 알바), track-work-a/b.ts (🏭 한국 일자리)
// ⚠️ 라오어·태국어·베트남어는 초안 — 원어민 검수 필요
import { TRACK_RESTAURANT } from './track-restaurant.ts'
import { TRACK_WORK_A } from './track-work-a.ts'
import { TRACK_WORK_B } from './track-work-b.ts'
import type { TitleL10n, TrackUnitSrc } from './track-types.ts'
import type { Purpose, Round, Word } from './words.ts'

export interface TrackSource {
  id: string
  purpose: Purpose
  icon: string
  title: TitleL10n
  desc: TitleL10n
  units: TrackUnitSrc[]
}

export const TRACK_SOURCES: TrackSource[] = [
  {
    id: 'restaurant',
    purpose: 'parttime',
    icon: '🍜',
    title: { ko: '한국 식당·가게 알바', lo: 'ວຽກພິເສດຮ້ານອາຫານເກົາຫຼີ', th: 'พาร์ตไทม์ร้านอาหารเกาหลี', vi: 'Làm thêm ở quán Hàn' },
    desc: { ko: '손님 맞이 · 주문 · 메뉴 · 주방 · 계산 · 근무', lo: 'ຕ້ອນຮັບ · ສັ່ງອາຫານ · ເມນູ · ເຮືອນຄົວ · ຈ່າຍເງິນ · ການເຮັດວຽກ', th: 'ต้อนรับ · รับออร์เดอร์ · เมนู · ครัว · คิดเงิน · การทำงาน', vi: 'Đón khách · Gọi món · Thực đơn · Bếp · Thanh toán · Ca làm' },
    units: TRACK_RESTAURANT,
  },
  {
    id: 'work',
    purpose: 'work',
    icon: '🏭',
    title: { ko: '한국 일자리 (고용허가제)', lo: 'ວຽກຢູ່ເກົາຫຼີ (EPS)', th: 'ทำงานที่เกาหลี (EPS)', vi: 'Việc làm tại Hàn (EPS)' },
    desc: { ko: '출근 · 공장 · 안전 · 농장 · 건설 · 월급 · 생활 · 서류', lo: 'ເຂົ້າວຽກ · ໂຮງງານ · ຄວາມປອດໄພ · ສວນ · ກໍ່ສ້າງ · ເງິນເດືອນ · ຊີວິດ · ເອກະສານ', th: 'เข้างาน · โรงงาน · ความปลอดภัย · ฟาร์ม · ก่อสร้าง · เงินเดือน · ชีวิต · เอกสาร', vi: 'Đi làm · Nhà máy · An toàn · Nông trại · Xây dựng · Lương · Sinh hoạt · Giấy tờ' },
    units: [...TRACK_WORK_A, ...TRACK_WORK_B],
  },
]

export interface Track {
  id: string
  purpose: Purpose
  icon: string
  title: TitleL10n
  desc: TitleL10n
  units: Round[]
}

function buildUnit(t: TrackSource, u: TrackUnitSrc, i: number): Round {
  const id = `t-${t.id}-${u.key}`
  const rows = [...u.words.map((r) => ({ r, phrase: false })), ...u.phrases.map((r) => ({ r, phrase: true }))]
  const words: Word[] = rows.map(({ r, phrase }, j) => ({
    id: `${id}-${String(j + 1).padStart(2, '0')}`,
    ko: r[0],
    rom: r[1],
    lo: r[2],
    th: r[3],
    vi: r[4],
    emoji: r[5],
    roundId: id,
    ...(phrase ? { kind: 'phrase' as const } : {}),
  }))
  return { id, tier: 0, no: i + 1, title: u.title, words, pack: { icon: u.icon, purpose: t.purpose, desc: t.title }, track: t.id }
}

export const TRACKS: Track[] = TRACK_SOURCES.map((t) => ({ ...t, units: t.units.map((u, i) => buildUnit(t, u, i)) }))
export const findTrack = (id: string) => TRACKS.find((t) => t.id === id)
