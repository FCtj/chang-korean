// 트랙 단원 목록 (홈의 코스 화면 · 트랙 화면에서 같이 씀)
import { useApp } from '../ctx'
import { stepOf, stepsDone, stepKnownCount, stepSizesOf, useStore } from '../store'
import type { Round } from '../data/words'
import type { Track } from '../data/tracks'

/** STEP 진행률 0~1 (STEP마다 전체 단어 수만큼 칸) */
export function unitProgress(s: ReturnType<typeof useStore>, r: Round): number {
  const n = stepSizesOf(r).length
  if (stepsDone(s, r.id)) return 1
  const st = stepOf(s, r.id)
  return ((st - 1) * r.words.length + stepKnownCount(s, r, st)) / (n * r.words.length)
}

export function MockCard() {
  const s = useStore()
  const { t, tf, push } = useApp()
  return (
    <button className="mock-card" onClick={() => push({ name: 'mock' })}>
      <span className="mock-card-icon" aria-hidden="true">
        📝
      </span>
      <span className="unit-body">
        <span className="unit-title">{t('mockTitle')}</span>
        <span className="unit-meta">{t('mockDesc')}</span>
        {s.bestMock > 0 && <span className="unit-no">{tf('mockBest', s.bestMock)}</span>}
      </span>
      <span className="pack-badge">{t('mockStart')}</span>
    </button>
  )
}

export default function UnitList({ track }: { track: Track }) {
  const s = useStore()
  const { t, tf, ui, push } = useApp()
  const next = track.units.find((u) => !stepsDone(s, u.id))
  return (
    <ol className="unit-list">
      {track.units.map((u) => {
        const pct = unitProgress(s, u)
        const isDone = pct >= 1
        const phrases = u.words.filter((w) => w.kind === 'phrase').length
        return (
          <li key={u.id}>
            <button className={`unit-card ${isDone ? 'done' : ''} ${next?.id === u.id ? 'next' : ''}`} onClick={() => push({ name: 'round', roundId: u.id })}>
              <span className="unit-icon" aria-hidden="true">
                {isDone ? '✅' : u.pack!.icon}
              </span>
              <span className="unit-body">
                <span className="unit-no">{tf('unitN', u.no)}</span>
                <span className="unit-title">{u.title[ui]}</span>
                <span className="unit-meta">{tf('itemsCount', u.words.length - phrases, phrases)}</span>
                <span className="pack-bar" aria-hidden="true">
                  <span style={{ width: `${Math.round(pct * 100)}%` }} />
                </span>
              </span>
              {next?.id === u.id && <span className="pack-badge">{t('startFirst')}</span>}
            </button>
          </li>
        )
      })}
    </ol>
  )
}
