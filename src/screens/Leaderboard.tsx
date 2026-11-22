// 리더보드: 실시간(오늘) / 이번 달 × 우리나라 / 전체
// 서버가 연결돼 있으면 실제 랭킹(누가 점수를 얻으면 바로 갱신), 아니면 예시 랭킹
// 실제 가입자만 보여 줌 (점수 0인 가입자도 아래쪽에)
import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../ctx'
import { backendReady, countryOf, fetchLeaderboard, fetchMyRank, signInWithFacebook, subscribeLeaderboard, useAuth, useMyPublic, type Period, type RankRow } from '../backend'
import { shownName } from '../privacy'
import { IS_KO } from '../edition'
import { LoginButtons } from './SettingsScreen'
import { todayKey, useStore } from '../store'
import { sfx } from '../audio'
import { fireworks, sparkleRain } from '../fx'
import { Avatar, Elephant, Segmented } from '../ui'

export default function Leaderboard() {
  const s = useStore()
  const auth = useAuth()
  const pub = useMyPublic()
  const { t, tf, ui, home } = useApp()
  const [ceremony, setCeremony] = useState<Ceremony | null>(null)
  const [period, setPeriod] = useState<Period>('today')
  // 테스트 기간엔 사람이 적어서 '전체'부터 (나라를 다르게 고른 친구도 바로 보이게)
  const [scope, setScope] = useState<'country' | 'all'>('all')
  const [rows, setRows] = useState<RankRow[] | null>(null)
  const [mine, setMine] = useState<{ rank: number; points: number; total: number } | null>(null)
  const [error, setError] = useState(false)
  const [flash, setFlash] = useState(false)
  const myCountry = auth.me?.country ?? s.country
  const c = countryOf(myCountry)
  const countryParam = IS_KO && scope === 'country' ? myCountry : null

  const load = useCallback(async () => {
    if (!backendReady) return
    try {
      const [list, me] = await Promise.all([fetchLeaderboard(period, countryParam), fetchMyRank(period, countryParam)])
      setRows(list)
      setMine(me)
      setError(false)
    } catch {
      setError(true)
    }
  }, [period, countryParam, auth.status])

  useEffect(() => {
    setRows(null)
    load()
  }, [load])

  // 실시간: 누가 점수를 얻으면 1.5초 안에 다시 불러옴 + 30초마다 한 번
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!backendReady) return
    const off = subscribeLeaderboard(() => {
      if (pending.current) return
      pending.current = setTimeout(() => {
        pending.current = null
        setFlash(true)
        setTimeout(() => setFlash(false), 900)
        load()
      }, 1500)
    })
    const poll = setInterval(load, 30000)
    return () => {
      off()
      clearInterval(poll)
      if (pending.current) clearTimeout(pending.current)
    }
  }, [load])

  // 실제 가입한 사람만 (예시 사용자 없음)
  const list: RankRow[] | null = !backendReady ? [] : rows
  const meRow = list?.find((r) => r.me) ?? null
  const myRankView = meRow ? { rank: meRow.rank, points: meRow.points, total: Math.max(list!.length, mine?.total ?? 0) } : mine

  // 랭킹을 열었을 때 한 번: 상위권이면 축하 세레머니, 아니면 격려 (하루에 기간·범위별 한 번)
  const ready = list !== null && (backendReady ? auth.status !== 'loading' : true)
  useEffect(() => {
    if (!ready || !list) return
    if (backendReady && auth.status !== 'in') return
    const key = `ck-cer:${todayKey()}:${period}:${scope}`
    try {
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
    } catch {
      /* 저장 안 돼도 보여 주기 */
    }
    const me = myRankView
    let c: Ceremony
    if (!me || me.points <= 0) c = { kind: 'norank' }
    else if (me.rank <= 3) c = { kind: (['gold', 'silver', 'bronze'] as const)[me.rank - 1], rank: me.rank, points: me.points }
    // 10명 이하일 때 10등 안은 의미가 없으니 '보상권 안' 축하는 11명 이상일 때만
    else if (me.rank <= 10 && me.total > 10) c = { kind: 'top10', rank: me.rank, points: me.points }
    else {
      const goalRank = Math.min(10, me.rank - 1)
      const target = list.find((r) => r.rank === goalRank)
      c = { kind: 'encourage', rank: me.rank, points: me.points, goal: target ? target.rank : undefined, gap: target ? Math.max(1, target.points - me.points + 1) : undefined }
    }
    const tm = setTimeout(() => {
      setCeremony(c)
      if (c.kind === 'gold' || c.kind === 'silver' || c.kind === 'bronze') {
        sfx.levelUp()
        fireworks(c.kind === 'gold' ? 10 : 7)
        sparkleRain(c.kind === 'gold' ? 40 : 26)
      } else if (c.kind === 'top10') {
        sfx.fanfare()
        sparkleRain(22)
      } else sfx.pop()
    }, 450)
    return () => clearTimeout(tm)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, period, scope])

  const podium = list && list.length >= 3 ? list.filter((r) => r.rank <= 3).slice(0, 3) : []
  const rest = podium.length === 3 ? list!.filter((r) => !podium.includes(r)) : list

  return (
    <section className={flash ? 'panel board flash-update' : 'panel board'}>
      <div className="panel-head">
        <h2 className="h3">🏆 {t('ranking')}</h2>
        {backendReady ? <span className="live-badge">● {t('live')}</span> : <span className="chip">{t('demoBadge')}</span>}
      </div>
      <Segmented<Period>
        name={t('ranking')}
        value={period}
        onChange={setPeriod}
        options={[
          { id: 'today', label: `⚡ ${t('rankLive')}` },
          { id: 'month', label: `📅 ${t('rankMonth')}` },
        ]}
      />
      {IS_KO && (
        <Segmented<'country' | 'all'>
          name={t('country')}
          value={scope}
          onChange={setScope}
          options={[
            { id: 'country', label: `${c.flag} ${c[ui]}` },
            { id: 'all', label: `🌏 ${t('scopeAll')}` },
          ]}
        />
      )}

      {backendReady && auth.status === 'out' &&
        (IS_KO ? (
          <button className="fb-btn" onClick={() => signInWithFacebook()}>
            <span className="fb-logo" aria-hidden="true">f</span> {t('joinRanking')}
          </button>
        ) : (
          <div className="rank-join">
            <p className="note">{t('joinRanking')}</p>
            <LoginButtons />
          </div>
        ))}

      {(auth.status === 'in' || !backendReady) && (
        <div className="my-rank">
          <Avatar pub src={pub.avatar} name={pub.name} size={44} />
          <div className="my-rank-body">
            <div className="my-rank-label">{t('myRank')}</div>
            <div className="my-rank-name">{pub.name}</div>
          </div>
          {myRankView ? (
            <div className="my-rank-num num">
              <span className="big">#{myRankView.rank}</span>
              <span className="small">⭐ {myRankView.points.toLocaleString()}</span>
            </div>
          ) : (
            <div className="my-rank-none">{t('notRanked')}</div>
          )}
        </div>
      )}

      {error && (
        <div className="board-msg">
          {t('rankError')}{' '}
          <button className="btn btn-soft sm" onClick={load}>
            {t('retry')}
          </button>
        </div>
      )}
      {list === null && !error && <div className="board-msg">…</div>}
      {list && list.length === 0 && !error && <div className="board-msg">{t('noRanks')}</div>}
      {podium.length === 3 && (
        <div className="podium" aria-label="TOP 3">
          {[podium[1], podium[0], podium[2]].map((r) => (
            <div key={r.userId} className={`pod pod-${r.rank} ${r.me ? 'me' : ''}`}>
              {r.rank === 1 && <span className="pod-crown" aria-hidden="true">👑</span>}
              <Avatar pub src={r.avatar} name={shownName(r.name)} size={r.rank === 1 ? 64 : 52} />
              <span className="pod-name">{shownName(r.name)}</span>
              <span className="pod-pts num">⭐ {r.points.toLocaleString()}</span>
              <span className="pod-block num">{['🥇', '🥈', '🥉'][r.rank - 1]}</span>
            </div>
          ))}
        </div>
      )}
      {rest && rest.length > 0 && (
        <ol className="board-list">
          {rest.map((r) => (
            <li key={r.userId + r.rank} className={r.me ? 'board-row me' : r.rank <= 3 ? 'board-row top' : 'board-row'}>
              <span className="board-rank num">{r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}</span>
              <Avatar pub src={r.avatar} name={shownName(r.name)} size={38} />
              <span className="board-name">
                <span className="board-name-text">{shownName(r.name)}</span>
                {r.me && <span className="me-tag">{t('me')}</span>}
              </span>
              {IS_KO && scope === 'all' && <span className="board-flag" title={countryOf(r.country)[ui]}>{countryOf(r.country).flag}</span>}
              <span className="board-pts num">{r.points.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}
      {myRankView && <p className="note center">{tf('rankOf', myRankView.rank, myRankView.total)}</p>}
      {!backendReady && <p className="note">{t('demoNote')}</p>}

      {ceremony && (
        <div className="cer-backdrop" onClick={() => setCeremony(null)}>
          <div className={`cer cer-${ceremony.kind}`} role="dialog" onClick={(e) => e.stopPropagation()}>
            {ceremony.kind === 'encourage' || ceremony.kind === 'norank' ? (
              <Elephant size={120} acc="star" mood="happy" className="bounce cheer" />
            ) : (
              <div className="cer-avatar">
                <span className="cer-ring" aria-hidden="true" />
                {ceremony.kind === 'gold' && <span className="cer-crown" aria-hidden="true">👑</span>}
                <Avatar pub src={pub.avatar} name={pub.name} size={104} />
                <span className="cer-medal" aria-hidden="true">
                  {ceremony.kind === 'gold' ? '🥇' : ceremony.kind === 'silver' ? '🥈' : ceremony.kind === 'bronze' ? '🥉' : '🎁'}
                </span>
              </div>
            )}
            <h2 className="cer-title">
              {ceremony.kind === 'gold'
                ? t('cer1')
                : ceremony.kind === 'silver' || ceremony.kind === 'bronze'
                  ? tf('cerRank', ceremony.rank!)
                  : ceremony.kind === 'top10'
                    ? tf('cerTop', ceremony.rank!)
                    : ceremony.kind === 'encourage'
                      ? t('encTitle')
                      : t('encNoRank')}
            </h2>
            <p className="cer-sub">
              {ceremony.kind === 'gold'
                ? t('cer1Sub')
                : ceremony.kind === 'encourage'
                  ? ceremony.gap
                    ? tf('encGap', ceremony.goal!, ceremony.gap)
                    : t('encSub')
                  : ceremony.kind === 'norank'
                    ? t('encSub')
                    : t('cerTopSub')}
            </p>
            {ceremony.points !== undefined && <div className="cer-points num">#{ceremony.rank} · ⭐ {ceremony.points.toLocaleString()}</div>}
            {ceremony.kind === 'encourage' || ceremony.kind === 'norank' ? (
              <>
                <button className="btn btn-pink btn-block" onClick={() => home('learn')}>
                  💪 {t('goStudy')}
                </button>
                <button className="btn btn-soft btn-block" onClick={() => setCeremony(null)}>
                  {t('ok')}
                </button>
              </>
            ) : (
              <button className="btn btn-butter btn-block" onClick={() => setCeremony(null)}>
                {t('thanks')}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

interface Ceremony {
  kind: 'gold' | 'silver' | 'bronze' | 'top10' | 'encourage' | 'norank'
  rank?: number
  points?: number
  goal?: number
  gap?: number
}
