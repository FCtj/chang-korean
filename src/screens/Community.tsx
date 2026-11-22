// 커뮤니티 탭: 나의 한국어 이력 + 내 그룹(랭킹 · 자랑하기 · 피드 · 반응)
import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../ctx'
import { backendReady, signInWithFacebook, useAuth } from '../backend'
import { learningRecord, useStore } from '../store'
import { TIERS, findRound } from '../data/words'
import { sfx } from '../audio'
import { burstFrom } from '../fx'
import { Avatar, Segmented } from '../ui'
import {
  GROUP_EMOJIS,
  REACTIONS,
  createGroup,
  deletePost,
  errorKey,
  groupFeed,
  groupRanking,
  isServerMode,
  joinGroup,
  leaveGroup,
  myGroups,
  postBrag,
  shareToMyGroups,
  subscribeFeed,
  toggleReaction,
  type BragData,
  type Group,
  type Member,
  type Post,
} from '../community'

const CUR_KEY = 'ck-group'
/** 블랙 테마에서는 리본 배지 대신 초보 배지 */
const tierBadge = (badge: string | undefined, theme: string) => (theme === 'carbon' && badge === '🎀' ? '🔰' : badge)
const readCur = () => {
  try {
    return localStorage.getItem(CUR_KEY)
  } catch {
    return null
  }
}

export default function Community() {
  const { t } = useApp()
  const auth = useAuth()
  const [groups, setGroups] = useState<Group[] | null>(null)
  const [cur, setCur] = useState<string | null>(readCur)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(false)
  const needLogin = backendReady && auth.status !== 'in'

  const load = useCallback(async () => {
    if (needLogin) return
    try {
      setGroups(await myGroups())
      setError(false)
    } catch {
      setError(true)
    }
  }, [needLogin])
  useEffect(() => {
    load()
  }, [load, auth.status])

  const pick = (id: string | null) => {
    setCur(id)
    setAdding(false)
    try {
      if (id) localStorage.setItem(CUR_KEY, id)
      else localStorage.removeItem(CUR_KEY)
    } catch {
      /* 무시 */
    }
  }
  const current = groups?.find((g) => g.id === cur) ?? groups?.[0] ?? null

  return (
    <div className="page community">
      <h1 className="h1">👥 {t('tabCommunity')}</h1>
      <RecordCard />

      {needLogin ? (
        <section className="panel center-panel">
          <p>{t('loginForCommunity')}</p>
          <button className="fb-btn" onClick={() => signInWithFacebook()}>
            <span className="fb-logo" aria-hidden="true">
              f
            </span>{' '}
            {t('fbLogin')}
          </button>
        </section>
      ) : error ? (
        <section className="panel center-panel">
          <p>{t('commError')}</p>
          <button className="btn btn-soft sm" onClick={load}>
            {t('retry')}
          </button>
        </section>
      ) : groups === null ? (
        <div className="board-msg">…</div>
      ) : (
        <>
          <div className="group-tabs" role="tablist" aria-label={t('groups')}>
            {groups.map((g) => (
              <button key={g.id} role="tab" aria-selected={!adding && current?.id === g.id} className={!adding && current?.id === g.id ? 'gtab on' : 'gtab'} onClick={() => pick(g.id)}>
                <span aria-hidden="true">{g.emoji}</span> {g.name}
              </button>
            ))}
            <button className={adding || groups.length === 0 ? 'gtab add on' : 'gtab add'} onClick={() => setAdding(true)} aria-label={t('createGroup')}>
              ＋
            </button>
          </div>
          {adding || !current ? (
            <GroupStart
              onDone={async (g) => {
                await load()
                pick(g.id)
              }}
            />
          ) : (
            <GroupView
              key={current.id}
              group={current}
              onLeft={async () => {
                pick(null)
                await load()
              }}
            />
          )}
        </>
      )}
      {!isServerMode() && <p className="note">{t('demoCommunity')}</p>}
    </div>
  )
}

/** 나의 한국어 이력 — 나중에 일자리·유학 연계의 바탕 */
function RecordCard() {
  const s = useStore()
  const auth = useAuth()
  const { t, tf, ui } = useApp()
  const r = learningRecord(s)
  const tier = TIERS.find((x) => x.no === r.tier)
  const dur = (min: number) => (min >= 60 ? tf('durHM', Math.floor(min / 60), min % 60) : tf('durMin', min))
  const stats: [string, string, string][] = [
    ['📅', t('statDays'), String(r.days)],
    ['🔥', t('statStreak'), String(r.streak)],
    ['⏱️', t('statTime'), dur(r.minutes)],
    ['📚', t('statWords'), String(r.words)],
    ['💯', t('statBest'), r.best ? `${r.best}/50` : '–'],
    ['📈', t('statConsistency'), `${r.consistency}%`],
  ]
  const weekMax = Math.max(10, ...r.week.map((d) => d.min))
  const weekTotal = r.week.reduce((n, d) => n + d.min, 0)
  const dayName = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString(ui === 'ko' ? 'ko' : ui, { weekday: 'narrow' })
  return (
    <section className="record-card" aria-label={t('myRecord')}>
      <div className="record-head">
        <Avatar src={auth.me?.avatar || s.photo} name={auth.me?.name ?? s.nickname} size={46} />
        <div className="record-who">
          <span className="record-label">CHANG KOREAN · RECORD</span>
          <span className="record-name">{auth.me?.name ?? s.nickname}</span>
          <span className="record-tier">
            {tierBadge(tier?.badge, s.theme)} {tf('tierN', r.tier)} · {tier?.name[ui]} · {tf('roundsPassedN', r.rounds)}
          </span>
        </div>
      </div>
      <h2 className="record-title">{t('myRecord')}</h2>
      <div className="record-grid">
        {stats.map(([icon, label, value]) => (
          <div key={label} className="record-stat">
            <span className="record-value num">{value}</span>
            <span className="record-stat-label">
              <span aria-hidden="true">{icon}</span> {label}
            </span>
          </div>
        ))}
      </div>
      <div className="record-week" aria-label={t('thisWeekStudy')}>
        <div className="record-week-head">
          <span>{t('thisWeekStudy')}</span>
          <span className="num">{dur(weekTotal)}</span>
        </div>
        <div className="record-bars">
          {r.week.map((d) => (
            <div key={d.day} className={d.today ? 'record-bar today' : 'record-bar'} title={`${d.day} · ${dur(d.min)}`}>
              <span className="record-bar-fill" style={{ height: `${Math.max(d.min ? 8 : 0, (d.min / weekMax) * 100)}%` }} />
              <span className="record-bar-day">{dayName(d.day)}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="record-note">{t('recordNote')}</p>
      <span className="record-soon">🔒 {t('recordShareSoon')}</span>
    </section>
  )
}

/** 그룹 만들기 / 코드로 들어가기 */
function GroupStart({ onDone }: { onDone: (g: Group) => void }) {
  const { t } = useApp()
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(GROUP_EMOJIS[0])
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<ReturnType<typeof errorKey> | null>(null)
  const run = async (fn: () => Promise<Group>) => {
    setBusy(true)
    setErr(null)
    try {
      onDone(await fn())
    } catch (e) {
      setErr(errorKey(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <p className="note center">{t('groupsEmpty')}</p>
      <section className="panel form">
        <h2 className="h3">✨ {t('createGroup')}</h2>
        <div className="field">
          <label htmlFor="g-name">{t('groupName')}</label>
          <input id="g-name" className="input" maxLength={30} placeholder={t('groupNamePh')} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="emoji-row" role="radiogroup" aria-label="emoji">
          {GROUP_EMOJIS.map((e) => (
            <button key={e} role="radio" aria-checked={emoji === e} className={emoji === e ? 'emoji-pick on' : 'emoji-pick'} onClick={() => setEmoji(e)}>
              {e}
            </button>
          ))}
        </div>
        <button className="btn btn-pink btn-block" disabled={busy || !name.trim()} onClick={() => run(() => createGroup(name, emoji))}>
          {t('create')}
        </button>
      </section>
      <section className="panel form">
        <h2 className="h3">🔑 {t('joinGroup')}</h2>
        <div className="join-row">
          <input
            className="input code-input"
            aria-label={t('groupCode')}
            placeholder="ABC123"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          />
          <button className="btn btn-soft" disabled={busy || code.length < 6} onClick={() => run(() => joinGroup(code))}>
            {t('join')}
          </button>
        </div>
        {!isServerMode() && <p className="note">{t('demoCodeHint')}</p>}
        <p className="note">🎓 {t('autoShareNote')}</p>
      </section>
      {err && <p className="note center err">{t(err)}</p>}
    </>
  )
}

function GroupView({ group, onLeft }: { group: Group; onLeft: () => void }) {
  const { t, tf } = useApp()
  const auth = useAuth()
  const [feed, setFeed] = useState<Post[] | null>(null)
  const [rank, setRank] = useState<Member[] | null>(null)
  const [period, setPeriod] = useState<'week' | 'month'>('week')
  const [copied, setCopied] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const myId = isServerMode() ? auth.me?.id : 'me'

  const loadFeed = useCallback(() => {
    groupFeed(group.id).then(setFeed, () => setFeed([]))
  }, [group.id])
  useEffect(() => {
    loadFeed()
    return subscribeFeed(group.id, loadFeed)
  }, [loadFeed, group.id])
  useEffect(() => {
    groupRanking(group.id, period).then(setRank, () => setRank([]))
  }, [group.id, period, feed])

  const invite = async () => {
    const text = `Chang Korean 🐘 ${group.name} — ${t('groupCode')}: ${group.code}`
    try {
      if (navigator.share) await navigator.share({ text })
      else await navigator.clipboard.writeText(group.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* 취소 */
    }
  }

  const top = rank?.slice(0, 5) ?? []
  const meRow = rank?.find((m) => m.me)
  const meIdx = rank && meRow ? rank.indexOf(meRow) : -1

  return (
    <>
      <section className="panel group-head">
        <div className="group-title">
          <span className="group-emoji" aria-hidden="true">
            {group.emoji}
          </span>
          <div className="group-title-text">
            <h2 className="h3">{group.name}</h2>
            <span className="note">{tf('memberCount', rank?.length ?? group.member_count)}</span>
          </div>
        </div>
        <div className="avatar-stack" aria-hidden="true">
          {(rank ?? []).slice(0, 7).map((m) => (
            <Avatar key={m.user_id} src={m.avatar} name={m.name} size={34} />
          ))}
          {(rank?.length ?? 0) > 7 && <span className="avatar-more">+{(rank?.length ?? 0) - 7}</span>}
        </div>
        <button className="invite-btn" onClick={invite}>
          <span>🔗 {t('invite')}</span>
          <span className="invite-code num">{group.code}</span>
        </button>
        {copied && <span className="toast-inline">✓ {t('copied')}</span>}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="h3">🏆 {t('groupRanking')}</h2>
        </div>
        <Segmented<'week' | 'month'>
          name={t('groupRanking')}
          value={period}
          onChange={setPeriod}
          options={[
            { id: 'week', label: t('thisWeek') },
            { id: 'month', label: t('thisMonth') },
          ]}
        />
        <ol className="grank">
          {top.map((m, i) => (
            <RankLine key={m.user_id} m={m} i={i} />
          ))}
          {meRow && meIdx >= 5 && (
            <>
              <li className="grank-gap" aria-hidden="true">
                ⋯
              </li>
              <RankLine m={meRow} i={meIdx} />
            </>
          )}
        </ol>
      </section>

      <Composer group={group} onPosted={loadFeed} />

      <section className="feed" aria-label="feed">
        {feed === null && <div className="board-msg">…</div>}
        {feed && feed.length === 0 && <p className="note center">{t('feedEmpty')}</p>}
        {feed?.map((p) => (
          <PostCard
            key={p.id}
            p={p}
            mine={p.user_id === myId}
            onChange={(next) => setFeed((f) => (f ? f.map((x) => (x.id === p.id ? next : x)) : f))}
            onDelete={async () => {
              await deletePost(p.id, group.id).catch(() => {})
              loadFeed()
            }}
          />
        ))}
      </section>

      <button
        className={confirmLeave ? 'btn btn-danger btn-block sm' : 'link-btn leave-btn'}
        onClick={async () => {
          if (!confirmLeave) return setConfirmLeave(true)
          await leaveGroup(group.id).catch(() => {})
          onLeft()
        }}
      >
        {confirmLeave ? t('leaveConfirm') : t('leaveGroup')}
      </button>
    </>
  )
}

function RankLine({ m, i }: { m: Member; i: number }) {
  const { t } = useApp()
  return (
    <li className={m.me ? 'grank-row me' : 'grank-row'}>
      <span className="grank-no num">{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span>
      <Avatar src={m.avatar} name={m.name} size={32} />
      <span className="grank-name">
        {m.name}
        {m.me && <span className="me-tag">{t('me')}</span>}
      </span>
      <span className="grank-pts num">{m.points.toLocaleString()}</span>
    </li>
  )
}

/** 자랑 문장: 데이터로 만들어서 보는 사람의 언어로 보여 줌 */
export function useDescribe() {
  const { tf, ui } = useApp()
  const theme = useStore().theme
  return (d: BragData): { icon: string; text: string } | null => {
    switch (d.type) {
      case 'words':
        return { icon: '📚', text: tf('bragWords', d.n ?? 0) }
      case 'streak':
        return { icon: '🔥', text: tf('bragStreak', d.n ?? 0) }
      case 'points':
        return { icon: '⭐', text: tf('bragPoints', d.n ?? 0) }
      case 'tier': {
        const tr = TIERS.find((x) => x.no === d.n)
        return { icon: tierBadge(tr?.badge, theme) ?? '🏅', text: `${tf('bragTier', d.n ?? 1)}${tr ? ` ${tr.name[ui]}` : ''}` }
      }
      case 'step': {
        const r = d.unit ? findRound(d.unit) : undefined
        const unit = r ? (r.pack ? `${r.pack.icon} ${r.title[ui]}` : tf('roundN', r.no)) : ''
        return { icon: '✅', text: tf('bragStep', unit, d.n ?? 1) }
      }
      case 'pack': {
        const r = d.unit ? findRound(d.unit) : undefined
        return { icon: r?.pack?.icon ?? '🎒', text: tf('bragPack', r ? r.title[ui] : '') }
      }
      case 'exam': {
        const r = d.ref ? findRound(d.ref) : undefined
        return { icon: '🎓', text: tf('bragExam', r?.no ?? 0, d.score) }
      }
      case 'promo':
        return { icon: '🏆', text: tf('bragPromo', Number(d.ref) || 1) }
      default:
        return null
    }
  }
}

function Composer({ group, onPosted }: { group: Group; onPosted: () => void }) {
  const s = useStore()
  const { t } = useApp()
  const describe = useDescribe()
  const r = learningRecord(s)
  const options: BragData[] = [
    ...(r.words > 0 ? [{ type: 'words' as const, n: r.words }] : []),
    ...(r.streak > 0 ? [{ type: 'streak' as const, n: r.streak }] : []),
    ...(s.monthPoints > 0 ? [{ type: 'points' as const, n: s.monthPoints }] : []),
    { type: 'tier' as const, n: r.tier },
  ]
  const [pick, setPick] = useState(0)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const chosen = options[Math.min(pick, options.length - 1)]
  return (
    <section className="panel composer">
      <h2 className="h3">📣 {t('bragPick')}</h2>
      <div className="brag-options" role="radiogroup" aria-label={t('brag')}>
        {options.map((o, i) => {
          const d = describe(o)!
          return (
            <button key={o.type} role="radio" aria-checked={pick === i} className={pick === i ? 'brag-opt on' : 'brag-opt'} onClick={() => setPick(i)}>
              <span aria-hidden="true">{d.icon}</span> {d.text}
            </button>
          )
        })}
      </div>
      <textarea className="input brag-text" rows={2} maxLength={200} placeholder={t('bragPh')} value={text} onChange={(e) => setText(e.target.value)} />
      <button
        ref={btn}
        className="btn btn-pink btn-block"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            await postBrag(group.id, text, chosen)
            setText('')
            setDone(true)
            setTimeout(() => setDone(false), 1600)
            sfx.pop()
            if (btn.current) burstFrom(btn.current, { count: 12 })
            onPosted()
          } catch {
            /* 실패하면 그대로 */
          } finally {
            setBusy(false)
          }
        }}
      >
        {done ? `✓ ${t('shared')}` : `🎉 ${t('post')}`}
      </button>
    </section>
  )
}

function timeAgo(iso: string, t: ReturnType<typeof useApp>['t'], tf: ReturnType<typeof useApp>['tf']) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return t('justNow')
  if (min < 60) return tf('minsAgo', min)
  if (min < 60 * 24) return tf('hoursAgo', Math.floor(min / 60))
  return tf('daysAgo', Math.floor(min / 1440))
}

function PostCard({ p, mine, onChange, onDelete }: { p: Post; mine: boolean; onChange: (p: Post) => void; onDelete: () => void }) {
  const { t, tf } = useApp()
  const describe = useDescribe()
  const d = describe(p.data)
  return (
    <article className={p.verified ? 'post verified' : 'post'}>
      <header className="post-head">
        <Avatar src={p.avatar} name={p.name} size={40} />
        <div className="post-who">
          <span className="post-name">{p.name}</span>
          <span className="post-time">{timeAgo(p.created_at, t, tf)}</span>
        </div>
        {p.verified && <span className="verified-tag">✓ {t('verified')}</span>}
        {mine && (
          <button className="link-btn post-del" onClick={onDelete}>
            {t('deletePost')}
          </button>
        )}
      </header>
      {d && (
        <div className="brag-badge">
          <span className="brag-icon" aria-hidden="true">
            {d.icon}
          </span>
          <span className="brag-line">{d.text}</span>
        </div>
      )}
      {p.body && <p className="post-body">{p.body}</p>}
      <div className="reactions">
        {REACTIONS.map((e) => {
          const on = p.mine.includes(e)
          const n = p.reactions[e] ?? 0
          return (
            <button
              key={e}
              className={on ? 'react on' : 'react'}
              aria-pressed={on}
              onClick={(ev) => {
                const next = { ...p, mine: on ? p.mine.filter((x) => x !== e) : [...p.mine, e], reactions: { ...p.reactions, [e]: Math.max(0, n + (on ? -1 : 1)) } }
                onChange(next)
                if (!on) burstFrom(ev.currentTarget, { count: 6, emojis: [e] })
                toggleReaction(p.id, e).catch(() => onChange(p))
              }}
            >
              <span aria-hidden="true">{e}</span>
              {n > 0 && <span className="react-n num">{n}</span>}
            </button>
          )
        })}
      </div>
    </article>
  )
}

/** 결과 화면에서 쓰는 '그룹에 자랑하기' 버튼 */
export function ShareToGroupButton({ data }: { data: BragData }) {
  const { t } = useApp()
  const auth = useAuth()
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'none'>('idle')
  if (backendReady && auth.status !== 'in') return null
  return (
    <button
      className="btn btn-soft btn-block share-btn"
      disabled={state === 'busy' || state === 'done'}
      onClick={async (ev) => {
        const el = ev.currentTarget
        setState('busy')
        try {
          const n = await shareToMyGroups(data)
          setState(n > 0 ? 'done' : 'none')
          if (n > 0) {
            sfx.pop()
            burstFrom(el, { count: 10 })
          }
        } catch {
          setState('idle')
        }
      }}
    >
      {state === 'done' ? `✓ ${t('shared')}` : state === 'none' ? t('groupsEmpty') : `👥 ${t('shareToGroup')}`}
    </button>
  )
}
