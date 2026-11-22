// 목적별 트랙: 단원(단어 25 + 상황 문장) 여러 개를 한 목적으로 묶음
// 원본: track-restaurant.ts (🍜 한국 식당·가게 알바), track-work-a/b.ts (🏭 한국 일자리)
// ⚠️ 라오어·태국어·베트남어는 초안 — 원어민 검수 필요
import { TRACK_RESTAURANT } from './track-restaurant.ts'
import { TRACK_WORK_A } from './track-work-a.ts'
import { TRACK_WORK_B } from './track-work-b.ts'
import { TRACK_CITIZEN } from './track-citizen.ts'
// 💼 일·알바: EPS-TOPIK 단어집 · 편의점·카페 · 호텔 · 마사지샵 · 여행 가이드 (+ 위의 한국 일자리 · 식당 알바)
import { TRACK_EPS_A, TRACK_EPS_A_META } from './track-eps-a.ts'
import { TRACK_EPS_B } from './track-eps-b.ts'
import { TRACK_STORE, TRACK_STORE_META } from './track-store.ts'
import { TRACK_HOTEL, TRACK_HOTEL_META } from './track-hotel.ts'
import { TRACK_MASSAGE, TRACK_MASSAGE_META } from './track-massage.ts'
import { TRACK_GUIDE, TRACK_GUIDE_META } from './track-guide.ts'
// 📝 TOPIK 1~6급: 급별 파일(track-topik-N.ts)이 들어오면 import 하고 TOPIK_UNITS 에 넣음
import { TRACK_TOPIK_1 } from './track-topik-1.ts'
import { TRACK_TOPIK_4 } from './track-topik-4.ts'
import { TRACK_TOPIK_2 } from './track-topik-2.ts'
import { TRACK_TOPIK_5 } from './track-topik-5.ts'
import { TRACK_TOPIK_3 } from './track-topik-3.ts'
import { TRACK_TOPIK_6 } from './track-topik-6.ts'
import type { TitleL10n, TrackUnitSrc } from './track-types.ts'
import type { Purpose, Round, Word } from './words.ts'
import { MN, withMn } from './tr-mn.ts'
import { AR } from './tr-ar.ts'

export interface TrackSource {
  id: string
  /** TOPIK 급별 트랙은 'topik', 일·알바 트랙은 'job' 으로 묶어서 한 코스로 보여 줌 */
  group?: 'topik' | 'job'
  level?: number
  purpose: Purpose
  icon: string
  title: TitleL10n
  desc: TitleL10n
  units: TrackUnitSrc[]
}

const TOPIK_UNITS: Record<number, TrackUnitSrc[]> = { 1: TRACK_TOPIK_1, 2: TRACK_TOPIK_2, 3: TRACK_TOPIK_3, 4: TRACK_TOPIK_4, 5: TRACK_TOPIK_5, 6: TRACK_TOPIK_6 }

const TOPIK_DESC: Record<number, TitleL10n> = {
  1: { ko: '생존 기초 — 인사·숫자·시간·장소·음식·쇼핑', lo: 'ຄຳສັບພື້ນຖານ — ທັກທາຍ·ຕົວເລກ·ເວລາ·ສະຖານທີ່·ອາຫານ·ຊື້ເຄື່ອງ', th: 'คำศัพท์พื้นฐาน — ทักทาย·ตัวเลข·เวลา·สถานที่·อาหาร·ช้อปปิ้ง', vi: 'Từ cơ bản — Chào hỏi·Số·Thời gian·Địa điểm·Ăn uống·Mua sắm' },
  2: { ko: '일상생활 — 교통·공공장소·병원·여행·취미·약속', lo: 'ຊີວິດປະຈຳວັນ — ການເດີນທາງ·ສະຖານທີ່ສາທາລະນະ·ໂຮງໝໍ·ທ່ອງທ່ຽວ·ງານອະດິເລກ·ນັດໝາຍ', th: 'ชีวิตประจำวัน — การเดินทาง·สถานที่ราชการ·โรงพยาบาล·ท่องเที่ยว·งานอดิเรก·นัดหมาย', vi: 'Đời sống — Giao thông·Nơi công cộng·Bệnh viện·Du lịch·Sở thích·Hẹn gặp' },
  3: { ko: '사회생활 — 직장·학업·주거·건강·인간관계·매체', lo: 'ຊີວິດໃນສັງຄົມ — ບ່ອນເຮັດວຽກ·ການຮຽນ·ທີ່ພັກ·ສຸຂະພາບ·ຄວາມສຳພັນ·ສື່', th: 'ชีวิตในสังคม — ที่ทำงาน·การเรียน·ที่พัก·สุขภาพ·ความสัมพันธ์·สื่อ', vi: 'Xã hội — Công sở·Học tập·Nhà ở·Sức khỏe·Quan hệ·Truyền thông' },
  4: { ko: '뉴스·사회 — 사회 문제·환경·교육·경제·과학·관용 표현', lo: 'ຂ່າວ·ສັງຄົມ — ບັນຫາສັງຄົມ·ສິ່ງແວດລ້ອມ·ການສຶກສາ·ເສດຖະກິດ·ວິທະຍາສາດ·ສຳນວນ', th: 'ข่าว·สังคม — ปัญหาสังคม·สิ่งแวดล้อม·การศึกษา·เศรษฐกิจ·วิทยาศาสตร์·สำนวน', vi: 'Tin tức·Xã hội — Vấn đề xã hội·Môi trường·Giáo dục·Kinh tế·Khoa học·Thành ngữ' },
  5: { ko: '전문 분야 — 정치·경제·과학·역사·철학·사자성어', lo: 'ສາຂາສະເພາະ — ການເມືອງ·ເສດຖະກິດ·ວິທະຍາສາດ·ປະຫວັດສາດ·ປັດຊະຍາ·ສຸພາສິດ', th: 'สาขาเฉพาะ — การเมือง·เศรษฐกิจ·วิทยาศาสตร์·ประวัติศาสตร์·ปรัชญา·สำนวนสี่คำ', vi: 'Chuyên ngành — Chính trị·Kinh tế·Khoa học·Lịch sử·Triết học·Thành ngữ Hán' },
  6: { ko: '학술·논설 — 고급 추상어·논설 동사·관용어·속담', lo: 'ວິຊາການ·ບົດຄວາມ — ຄຳນາມທຳມະ·ຄຳກິລິຍາວິຊາການ·ສຳນວນ·ສຸພາສິດ', th: 'วิชาการ·บทความ — คำนามนามธรรม·กริยาเชิงวิชาการ·สำนวน·สุภาษิต', vi: 'Học thuật·Nghị luận — Danh từ trừu tượng·Động từ nghị luận·Quán ngữ·Tục ngữ' },
}
export const TOPIK_ICON = ['📘', '📘', '📗', '📗', '📕', '📕']

function TOPIK_SOURCES(): TrackSource[] {
  return [1, 2, 3, 4, 5, 6].map((n) => ({
    id: `topik-${n}`,
    group: 'topik' as const,
    level: n,
    purpose: 'school' as const,
    icon: TOPIK_ICON[n - 1],
    title: { ko: `TOPIK ${n}급`, lo: `TOPIK ລະດັບ ${n}`, th: `TOPIK ระดับ ${n}`, vi: `TOPIK cấp ${n}` },
    desc: TOPIK_DESC[n],
    units: TOPIK_UNITS[n] ?? [],
  }))
}

const WORK_TITLE: TitleL10n = { ko: '한국 일자리 (고용허가제)', lo: 'ວຽກຢູ່ເກົາຫຼີ (EPS)', th: 'ทำงานที่เกาหลี (EPS)', vi: 'Việc làm tại Hàn (EPS)' }
const WORK_DESC: TitleL10n = { ko: '출근 · 공장 · 안전 · 농장 · 건설 · 월급 · 생활 · 서류', lo: 'ເຂົ້າວຽກ · ໂຮງງານ · ຄວາມປອດໄພ · ສວນ · ກໍ່ສ້າງ · ເງິນເດືອນ · ຊີວິດ · ເອກະສານ', th: 'เข้างาน · โรงงาน · ความปลอดภัย · ฟาร์ม · ก่อสร้าง · เงินเดือน · ชีวิต · เอกสาร', vi: 'Đi làm · Nhà máy · An toàn · Nông trại · Xây dựng · Lương · Sinh hoạt · Giấy tờ' }

export const TRACK_SOURCES: TrackSource[] = [
  {
    id: 'eps',
    group: 'job',
    purpose: 'work',
    icon: '📗',
    ...TRACK_EPS_A_META,
    units: [...TRACK_EPS_A, ...TRACK_EPS_B],
  },
  {
    id: 'work',
    group: 'job',
    purpose: 'work',
    icon: '🏭',
    title: WORK_TITLE,
    desc: WORK_DESC,
    units: [...TRACK_WORK_A, ...TRACK_WORK_B],
  },
  {
    id: 'restaurant',
    group: 'job',
    purpose: 'parttime',
    icon: '🍜',
    title: { ko: '한국 식당·가게 알바', lo: 'ວຽກພິເສດຮ້ານອາຫານເກົາຫຼີ', th: 'พาร์ตไทม์ร้านอาหารเกาหลี', vi: 'Làm thêm ở quán Hàn' },
    desc: { ko: '손님 맞이 · 주문 · 메뉴 · 주방 · 계산 · 근무', lo: 'ຕ້ອນຮັບ · ສັ່ງອາຫານ · ເມນູ · ເຮືອນຄົວ · ຈ່າຍເງິນ · ການເຮັດວຽກ', th: 'ต้อนรับ · รับออร์เดอร์ · เมนู · ครัว · คิดเงิน · การทำงาน', vi: 'Đón khách · Gọi món · Thực đơn · Bếp · Thanh toán · Ca làm' },
    units: TRACK_RESTAURANT,
  },
  { id: 'store', group: 'job', purpose: 'parttime', icon: '🏪', ...TRACK_STORE_META, units: TRACK_STORE },
  { id: 'hotel', group: 'job', purpose: 'work', icon: '🏨', ...TRACK_HOTEL_META, units: TRACK_HOTEL },
  { id: 'massage', group: 'job', purpose: 'parttime', icon: '💆', ...TRACK_MASSAGE_META, units: TRACK_MASSAGE },
  { id: 'guide', group: 'job', purpose: 'work', icon: '🧳', ...TRACK_GUIDE_META, units: TRACK_GUIDE },
    {
      id: 'citizen',
      purpose: 'citizen',
      icon: '🇰🇷',
      title: { ko: '한국 국적·영주 준비', lo: 'ກະກຽມສັນຊາດ·ພັກເຊົາຖາວອນເກົາຫຼີ', th: 'เตรียมสัญชาติ·พำนักถาวรเกาหลี', vi: 'Chuẩn bị quốc tịch·thường trú Hàn' },
      desc: {
        ko: '사회통합프로그램·귀화 면접 대비 · 국가 상징 · 정치 · 법 · 역사 · 지리 · 경제 · 문화 · 면접 표현 + 모의 평가',
        lo: 'ກຽມສອບ KIIP·ສຳພາດ · ສັນຍາລັກຊາດ · ການເມືອງ · ກົດໝາຍ · ປະຫວັດສາດ · ພູມສາດ · ເສດຖະກິດ · ວັດທະນະທຳ + ທົດສອບຈຳລອງ',
        th: 'เตรียมสอบ KIIP·สัมภาษณ์ · สัญลักษณ์ชาติ · การเมือง · กฎหมาย · ประวัติศาสตร์ · ภูมิศาสตร์ · เศรษฐกิจ · วัฒนธรรม + แบบทดสอบจำลอง',
        vi: 'Ôn KIIP·phỏng vấn nhập tịch · Biểu tượng quốc gia · Chính trị · Pháp luật · Lịch sử · Địa lý · Kinh tế · Văn hóa + Thi thử',
      },
      units: TRACK_CITIZEN,
    },
  ...TOPIK_SOURCES(),
]

export interface Track {
  id: string
  group?: 'topik' | 'job'
  level?: number
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
    mn: MN[r[0]] || '',
    ar: AR[r[0]] || '',
    lo: r[2],
    th: r[3],
    vi: r[4],
    emoji: r[5],
    roundId: id,
    ...(phrase ? { kind: 'phrase' as const } : {}),
  }))
  return { id, tier: 0, no: i + 1, title: withMn(u.title), words, pack: { icon: u.icon, purpose: t.purpose, desc: withMn(t.title) }, track: t.id }
}

export const TRACKS: Track[] = TRACK_SOURCES.map((t) => ({ ...t, title: withMn(t.title), desc: withMn(t.desc), units: t.units.map((u, i) => buildUnit(t, u, i)) }))
export const findTrack = (id: string) => TRACKS.find((t) => t.id === id)
