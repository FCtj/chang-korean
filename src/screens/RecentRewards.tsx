// 테스트 기간 예시: 최근 포인트 교환 내역 (포인트 탭 목록 · 홈 지갑 카드 한 줄)
import { useEffect, useState } from 'react'
import { useApp } from '../ctx'
import { SAMPLE_DATA } from '../config'
import { SAMPLE_REDEMPTIONS, type SampleRedemption } from '../data/sample-rewards'
import { Avatar } from '../ui'

function useAgo() {
  const { tf } = useApp()
  return (h: number) => (h < 24 ? tf('agoH', Math.max(1, h)) : tf('agoD', Math.floor(h / 24)))
}

/** 포인트 탭: 최근 교환 내역 */
export default function RecentRewards() {
  const { t, ui } = useApp()
  const ago = useAgo()
  if (!SAMPLE_DATA) return null
  return (
    <section className="panel recent-rewards">
      <div className="panel-head">
        <h2 className="h3">🎉 {t('recentRewards')}</h2>
        <span className="chip">{t('demoBadge')}</span>
      </div>
      <ol className="rr-list">
        {SAMPLE_REDEMPTIONS.map((r: SampleRedemption) => (
          <li key={r.person.name} className="rr-row">
            <Avatar pub src={r.person.avatar} name={r.person.name} size={38} />
            <span className="rr-body">
              <span className="rr-name">{r.person.name}</span>
              <span className="rr-what">
                <span aria-hidden="true">{r.item.icon}</span> {r.item.name[ui]} · {t('exchanged')}
              </span>
            </span>
            <span className="rr-time">{ago(r.hoursAgo)}</span>
          </li>
        ))}
      </ol>
      <p className="note">{t('sampleNote')}</p>
    </section>
  )
}

/** 홈 지갑 카드: 한 줄씩 돌아가는 교환 소식 */
export function RewardTicker() {
  const { t, ui } = useApp()
  const ago = useAgo()
  const [i, setI] = useState(0)
  useEffect(() => {
    if (!SAMPLE_DATA) return
    const id = setInterval(() => setI((n) => (n + 1) % SAMPLE_REDEMPTIONS.length), 3500)
    return () => clearInterval(id)
  }, [])
  if (!SAMPLE_DATA || !SAMPLE_REDEMPTIONS.length) return null
  const r = SAMPLE_REDEMPTIONS[i]
  return (
    <span className="reward-ticker" aria-live="off">
      <span key={i} className="reward-ticker-line">
        🎉 <b>{r.person.name}</b> · {r.item.icon} {r.item.name[ui]} {t('exchanged')} · {ago(r.hoursAgo)}
      </span>
      <span className="reward-ticker-tag">{t('demoBadge')}</span>
    </span>
  )
}
