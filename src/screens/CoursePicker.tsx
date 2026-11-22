// 코스 고르기: 처음 체험 끝 · 홈 '코스 바꾸기' 창 · 홈 아래 '다른 코스' 줄
import { useApp } from '../ctx'
import { COURSES, courseTracks, type CourseId } from '../data/courses'
import { PACKS, ROUNDS, type Round } from '../data/words'
import { currentCourse, setCourse, stepsDone, useStore, type State } from '../store'
import { sfx } from '../audio'
import { MASCOT_EMOJI, mascotOf } from '../mascot'

/** 코스 진행: 끝낸 단원 / 전체 단원 */
export function courseProgress(s: State, id: CourseId): { done: number; total: number } {
  const units: Round[] = id === 'basic' ? [...PACKS, ...ROUNDS] : courseTracks(id).flatMap((t) => t.units)
  const done = units.filter((u) => stepsDone(s, u.id) || s.passedRounds.includes(u.id)).length
  return { done, total: units.length }
}

export default function CoursePicker({ current, onPick }: { current: CourseId | null; onPick: (id: CourseId) => void }) {
  const s = useStore()
  const { t, tf, ui } = useApp()
  return (
    <div className="course-list" role="list">
      {COURSES.map((c) => {
        const { done, total } = courseProgress(s, c.id)
        const on = c.id === current
        return (
          <button key={c.id} role="listitem" className={on ? 'course-card on' : 'course-card'} aria-current={on || undefined} onClick={() => onPick(c.id)}>
            {on && <span className="pack-badge">{t('nowStudying')}</span>}
            <span className="course-icon" aria-hidden="true">
              {c.id === 'basic' ? MASCOT_EMOJI[mascotOf(s.country)] : c.icon}
            </span>
            <span className="course-body">
              <span className="course-title">{c.title[ui]}</span>
              <span className="course-desc">{c.desc[ui]}</span>
              <span className="course-meta num">{total ? tf('unitsDone', done, total) : t('comingSoon')}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** 홈: 코스 바꾸기 창 */
export function CourseSheet({ onClose }: { onClose: () => void }) {
  const s = useStore()
  const { t } = useApp()
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="sheet course-sheet" role="dialog" aria-label={t('changeCourse')} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" aria-hidden="true" />
        <h2 className="h3">⇄ {t('changeCourse')}</h2>
        <p className="note">{t('courseHint')}</p>
        <CoursePicker
          current={currentCourse(s)}
          onPick={(id) => {
            sfx.pop()
            setCourse(id)
            onClose()
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        />
      </section>
    </div>
  )
}

/** 홈 아래: 다른 코스 (가로로 넘겨 보기) */
export function OtherCourses() {
  const s = useStore()
  const { t, ui } = useApp()
  const cur = currentCourse(s)
  return (
    <section className="other-courses">
      <h2 className="h3">🧭 {t('otherCourses')}</h2>
      <div className="other-row">
        {COURSES.filter((c) => c.id !== cur).map((c) => {
          const { done, total } = courseProgress(s, c.id)
          return (
            <button
              key={c.id}
              className="other-card"
              onClick={() => {
                sfx.pop()
                setCourse(c.id)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            >
              <span className="other-icon" aria-hidden="true">
                {c.id === 'basic' ? MASCOT_EMOJI[mascotOf(s.country)] : c.icon}
              </span>
              <span className="other-title">{c.title[ui]}</span>
              <span className="pack-bar" aria-hidden="true">
                <span style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }} />
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
