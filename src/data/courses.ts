// 코스 = 홈에서 '지금 공부하는 것' 한 가지
// 기초(단어팩 + 1~5계급) · TOPIK(1~6급) · 일·알바(EPS 단어집 · 일자리 · 식당 · 편의점·카페 · 호텔 · 마사지샵 · 가이드) · 국적·영주
// 'work'·'restaurant' 는 예전 코스 값 (불러올 때 'job' + 그 트랙으로 바꿈)
import { TRACKS, findTrack, type Track } from './tracks.ts'
import type { TitleL10n } from './track-types.ts'
import { withMn } from './tr-mn.ts'

export type CourseId = 'basic' | 'topik' | 'job' | 'parenting' | 'citizen'
export const COURSE_IDS: CourseId[] = ['basic', 'topik', 'job', 'parenting', 'citizen']

export interface Course {
  id: CourseId
  icon: string
  title: TitleL10n
  desc: TitleL10n
}

export const TOPIK_LEVELS = [1, 2, 3, 4, 5, 6]
export const topikTrack = (n: number): Track | undefined => findTrack(`topik-${n}`)
export const TOPIK_TRACKS = TRACKS.filter((t) => t.group === 'topik')
export const JOB_TRACKS = TRACKS.filter((t) => t.group === 'job')
export const isJobTrack = (id: string) => JOB_TRACKS.some((t) => t.id === id)

const BASIC: Course = {
  id: 'basic',
  icon: '🐘',
  title: { ko: '기초 한국어', lo: 'ພາສາເກົາຫຼີພື້ນຖານ', th: 'ภาษาเกาหลีพื้นฐาน', vi: 'Tiếng Hàn cơ bản' },
  desc: { ko: '꼭 필요한 단어팩 + 1~5계급 900단어', lo: 'ຊຸດຄຳສັບຈຳເປັນ + ຂັ້ນ 1–5 (900 ຄຳ)', th: 'ชุดคำศัพท์จำเป็น + ขั้น 1–5 (900 คำ)', vi: 'Gói từ thiết yếu + cấp 1–5 (900 từ)' },
}
const TOPIK: Course = {
  id: 'topik',
  icon: '📝',
  title: { ko: 'TOPIK 1~6급', lo: 'TOPIK ລະດັບ 1–6', th: 'TOPIK ระดับ 1–6', vi: 'TOPIK cấp 1–6' },
  desc: { ko: '한국어능력시험 급별 핵심 단어 · TOPIK I (1·2급) · TOPIK II (3~6급)', lo: 'ຄຳສັບຫຼັກຕາມລະດັບສອບ TOPIK · TOPIK I (1·2) · TOPIK II (3–6)', th: 'คำศัพท์หลักตามระดับสอบ TOPIK · TOPIK I (1·2) · TOPIK II (3–6)', vi: 'Từ vựng trọng tâm theo cấp TOPIK · TOPIK I (1·2) · TOPIK II (3–6)' },
}
const JOB: Course = {
  id: 'job',
  icon: '💼',
  title: { ko: '일·알바 한국어', lo: 'ພາສາເກົາຫຼີເພື່ອເຮັດວຽກ', th: 'ภาษาเกาหลีเพื่อการทำงาน', vi: 'Tiếng Hàn đi làm', mn: 'Ажлын солонгос хэл', ar: 'الكورية للعمل' },
  desc: {
    ko: 'EPS-TOPIK 단어집 · 한국 일자리 · 식당 · 편의점·카페 · 호텔 · 마사지샵 · 여행 가이드',
    lo: 'ປຶ້ມຄຳສັບ EPS-TOPIK · ວຽກຢູ່ເກົາຫຼີ · ຮ້ານອາຫານ · ຮ້ານສະດວກຊື້·ຄາເຟ · ໂຮງແຮມ · ຮ້ານນວດ · ໄກດ໌ນຳທ່ຽວ',
    th: 'คลังคำศัพท์ EPS-TOPIK · งานในเกาหลี · ร้านอาหาร · ร้านสะดวกซื้อ·คาเฟ่ · โรงแรม · ร้านนวด · ไกด์นำเที่ยว',
    vi: 'Từ vựng EPS-TOPIK · Việc làm tại Hàn · Quán ăn · Cửa hàng tiện lợi·Cà phê · Khách sạn · Tiệm massage · Hướng dẫn viên',
    mn: 'EPS-TOPIK үгийн сан · Солонгост ажил · Ресторан · Дэлгүүр·Кафе · Зочид буудал · Массаж · Аялалын хөтөч',
    ar: 'مفردات EPS-TOPIK · العمل في كوريا · المطعم · المتجر·المقهى · الفندق · محل التدليك · المرشد السياحي',
  },
}
function fromTrack(id: CourseId): Course {
  const t = findTrack(id)!
  return { id, icon: t.icon, title: t.title, desc: t.desc }
}

export const COURSES: Course[] = [BASIC, TOPIK, JOB, fromTrack('parenting'), fromTrack('citizen')].map((c) => ({ ...c, title: withMn(c.title), desc: withMn(c.desc) }))
export const findCourse = (id: CourseId): Course => COURSES.find((c) => c.id === id) ?? BASIC

/** 일·알바 코스에서 지금 고른 트랙 */
export const jobTrack = (id: string): Track | undefined => (isJobTrack(id) ? findTrack(id) : undefined)

/** 코스에 들어 있는 트랙 (기초는 트랙이 아니라 단어팩·계급이라 빈 배열) */
export function courseTracks(id: CourseId): Track[] {
  if (id === 'basic') return []
  if (id === 'topik') return TOPIK_TRACKS
  if (id === 'job') return JOB_TRACKS
  const t = findTrack(id)
  return t ? [t] : []
}
