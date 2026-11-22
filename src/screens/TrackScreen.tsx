// 목적별 트랙: 단원 목록 (단원 = 단어 25 + 상황 문장)
import { useApp } from '../ctx'
import { findTrack } from '../data/tracks'
import { stepOf, stepsDone, stepKnownCount, stepSizesOf, useStore } from '../store'
import type { Round } from '../data/words'
import { TopBar } from '../ui'

function progress(s: ReturnType<typeof useStore>, r: Round): number {
  const n = stepSizesOf(r).length
  if (stepsDone(s, r.id)) return 1
  const st = stepOf(s, r.id)
  return ((st - 1) * r.words.length + stepKnownCount(s, r, st)) / (n * r.words.length)
}

export default function TrackScreen({ trackId }: { trackId: string }) {
  const s = useStore()
  const { t, tf, ui, push } = useApp()
  const track = findTrack(trackId)
  if (!track) return null
  const done = track.units.filter((u) => stepsDone(s, u.id)).length
  const next = track.units.find((u) => !stepsDone(s, u.id))
  return (
    <div className="screen">
      <TopBar title={`${track.icon} ${track.title[ui]}`} sub={tf('unitsDone', done, track.units.length)} />
      <div className="page">
        <p className="note">{track.desc[ui]}</p>
        <div className="track-progress" aria-hidden="true">
          <span style={{ width: `${Math.round((done / track.units.length) * 100)}%` }} />
        </div>
        {track.id === 'citizen' && (
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
        )}
        <ol className="unit-list">
          {track.units.map((u) => {
            const pct = progress(s, u)
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
      </div>
    </div>
  )
}
