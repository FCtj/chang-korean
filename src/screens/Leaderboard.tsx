// 리더보드: 실시간(오늘) / 이번 달 × 우리나라 / 전체
// 서버가 연결돼 있으면 실제 랭킹(누가 점수를 얻으면 바로 갱신), 아니면 예시 랭킹
import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../ctx'
import { backendReady, countryOf, fetchLeaderboard, fetchMyRank, signInWithFacebook, subscribeLeaderboard, useAuth, type Period, type RankRow } from '../backend'
import { demoRanking, useStore } from '../store'
import { Avatar, Segmented } from '../ui'

export default function Leaderboard() {
  const s = useStore()
  const auth = useAuth()
  const { t, tf, ui } = useApp()
  const [period, setPeriod] = useState<Period>('today')
  const [scope, setScope] = useState<'country' | 'all'>('country')
  const [rows, setRows] = useState<RankRow[] | null>(null)
  const [mine, setMine] = useState<{ rank: number; points: number; total: number } | null>(null)
  const [error, setError] = useState(false)
  const [flash, setFlash] = useState(false)
  const myCountry = auth.me?.country ?? s.country
  const c = countryOf(myCountry)
  const countryParam = scope === 'country' ? myCountry : null

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

  // 예시 랭킹 (서버 연결 전)
  const demo: RankRow[] = backendReady
    ? []
    : demoRanking(s)
        .map((r, i) => ({ rank: i + 1, userId: r.name, name: r.name, avatar: null, country: r.me ? s.country : i % 4 === 3 ? 'TH' : 'LA', points: period === 'today' ? Math.round(r.points / 12) : r.points, me: r.me }))
        .filter((r) => scope === 'all' || r.country === myCountry)
        .map((r, i) => ({ ...r, rank: i + 1 }))
  const list = backendReady ? rows : demo
  const meRow = !backendReady ? demo.find((r) => r.me) : null
  const myRankView = backendReady ? mine : meRow ? { rank: meRow.rank, points: meRow.points, total: demo.length } : null

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
      <Segmented<'country' | 'all'>
        name={t('country')}
        value={scope}
        onChange={setScope}
        options={[
          { id: 'country', label: `${c.flag} ${c[ui === 'ko' ? 'ko' : 'lo']}` },
          { id: 'all', label: `🌏 ${t('scopeAll')}` },
        ]}
      />

      {backendReady && auth.status === 'out' && (
        <button className="fb-btn" onClick={() => signInWithFacebook()}>
          <span className="fb-logo" aria-hidden="true">f</span> {t('joinRanking')}
        </button>
      )}

      {(auth.status === 'in' || !backendReady) && (
        <div className="my-rank">
          <Avatar src={auth.me?.avatar} name={auth.me?.name ?? s.nickname} size={44} />
          <div className="my-rank-body">
            <div className="my-rank-label">{t('myRank')}</div>
            <div className="my-rank-name">{auth.me?.name ?? s.nickname}</div>
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
      {list && list.length > 0 && (
        <ol className="board-list">
          {list.map((r) => (
            <li key={r.userId + r.rank} className={r.me ? 'board-row me' : r.rank <= 3 ? 'board-row top' : 'board-row'}>
              <span className="board-rank num">{r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}</span>
              <Avatar src={r.avatar} name={r.name} size={38} />
              <span className="board-name">
                <span className="board-name-text">{r.name}</span>
                {r.me && <span className="me-tag">{t('me')}</span>}
              </span>
              {scope === 'all' && <span className="board-flag" title={countryOf(r.country).ko}>{countryOf(r.country).flag}</span>}
              <span className="board-pts num">{r.points.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}
      {myRankView && <p className="note center">{tf('rankOf', myRankView.rank, myRankView.total)}</p>}
      {!backendReady && <p className="note">{t('demoNote')}</p>}
    </section>
  )
}
