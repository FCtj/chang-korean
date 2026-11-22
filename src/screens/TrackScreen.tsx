// 목적별 트랙: 단원 목록 (단원 = 단어 25 + 상황 문장)
import { useApp } from '../ctx'
import { findTrack } from '../data/tracks'
import { stepsDone, useStore } from '../store'
import { TopBar } from '../ui'
import UnitList, { MockCard } from './UnitList'

export default function TrackScreen({ trackId }: { trackId: string }) {
  const s = useStore()
  const { t, tf, ui } = useApp()
  const track = findTrack(trackId)
  if (!track) return null
  const done = track.units.filter((u) => stepsDone(s, u.id)).length
  const total = Math.max(1, track.units.length)
  return (
    <div className="screen">
      <TopBar title={`${track.icon} ${track.title[ui]}`} sub={tf('unitsDone', done, track.units.length)} />
      <div className="page">
        <p className="note">{track.desc[ui]}</p>
        <div className="track-progress" aria-hidden="true">
          <span style={{ width: `${Math.round((done / total) * 100)}%` }} />
        </div>
        {track.id === 'citizen' && <MockCard />}
        {track.units.length ? <UnitList track={track} /> : <p className="panel center-panel">{t('levelSoon')}</p>}
      </div>
    </div>
  )
}
