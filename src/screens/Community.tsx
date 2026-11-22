// 커뮤니티 탭: 🌏 전체 공개 게시판 · 🔒 내 그룹(멤버만: 랭킹 · 자랑하기 · 글 · 댓글) · 🙋 내 활동(이력 · 내 글 · 내 댓글)
// 공개 글과 그룹 글은 카드마다 🌏 공개 / 🔒 그룹 이름 · 멤버만 으로 구분
import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../ctx'
import { backendReady, signInWithFacebook, useAuth, useMyPublic } from '../backend'
import { learningRecord, useStore } from '../store'
import { sfx } from '../audio'
import { burstFrom } from '../fx'
import { mascotOf, rankEmoji, tierName } from '../mascot'
import { Avatar, Segmented } from '../ui'
import { TIERS } from '../data/words'
import { PostCard, ThreadSheet, WriteSheet, useBragOptions, useDescribe } from './communityParts'
import { MyActivityView, PublicBoard, newCommentCount, readSeen } from './Board'
export { useDescribe }
import {
  GROUP_EMOJIS,
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
  myActivity,
  type BragData,
  type Group,
  type Member,
  type Post,
} from '../community'

const CUR_KEY = 'ck-group'
const readCur = () => {
  try {
    return localStorage.getItem(CUR_KEY)
  } catch {
    return null
  }
}

type CommTab = 'public' | 'groups' | 'mine'
const TAB_KEY = 'ck-comm-tab'
const readTab = (): CommTab => {
  try {
    const v = localStorage.getItem(TAB_KEY)
    return v === 'groups' || v === 'mine' ? v : 'public'
  } catch {
    return 'public'
  }
}

export default function Community() {
  const { t } = useApp()
  const auth = useAuth()
  const [tab, setTabState] = useState<CommTab>(readTab)
  const [unread, setUnread] = useState(0)
  const setTab = (x: CommTab) => {
    setTabState(x)
    try {
      localStorage.setItem(TAB_KEY, x)
    } catch {
      /* 무시 */
    }
  }
  useEffect(() => {
    if (!isServerMode()) return
    myActivity().then((a) => setUnread(newCommentCount(a, readSeen())), () => {})
  }, [auth.status])
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
      <div className="comm-tabs" role="tablist" aria-label={t('tabCommunity')}>
        {(
          [
            ['public', '🌏', t('commPublic')],
            ['groups', '🔒', t('commGroups')],
            ['mine', '🙋', t('commMine')],
          ] as [CommTab, string, string][]
        ).map(([id, icon, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'comm-tab on' : 'comm-tab'} onClick={() => setTab(id)}>
            <span aria-hidden="true">{icon}</span> {label}
            {id === 'mine' && unread > 0 && tab !== 'mine' && <span className="comm-dot num">{unread}</span>}
          </button>
        ))}
      </div>
      <p className="comm-tab-note">{tab === 'public' ? `🌏 ${t('visPublicDesc')}` : tab === 'groups' ? `🔒 ${t('visGroupDesc')}` : ''}</p>

      {tab === 'public' && <PublicBoard />}
      {tab === 'mine' && (
        <>
          <RecordCard />
          <MyActivityView onActivity={() => setUnread(0)} />
        </>
      )}

      {tab !== 'groups' ? null : needLogin ? (
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
              groups={groups}
              onLeft={async () => {
                pick(null)
                await load()
              }}
            />
          )}
        </>
      )}
      {tab === 'groups' && !isServerMode() && <p className="note">{t('demoCommunity')}</p>}
    </div>
  )
}

/** 나의 한국어 이력 — 나중에 일자리·유학 연계의 바탕 */
function RecordCard() {
  const s = useStore()
  const auth = useAuth()
  const pub = useMyPublic()
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
        <Avatar src={pub.avatar} name={pub.name} size={46} />
        <div className="record-who">
          <span className="record-label">CHANG KOREAN · RECORD</span>
          <span className="record-name">{pub.name}</span>
          <span className="record-tier">
            {rankEmoji(r.tier)} {tf('tierN', r.tier)} · {tierName(tier, mascotOf(s.country))?.[ui]} · {tf('roundsPassedN', r.rounds)}
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

function GroupView({ group, groups, onLeft }: { group: Group; groups: Group[]; onLeft: () => void }) {
  const { t, tf } = useApp()
  const auth = useAuth()
  const [feed, setFeed] = useState<Post[] | null>(null)
  const [rank, setRank] = useState<Member[] | null>(null)
  const [period, setPeriod] = useState<'week' | 'month'>('week')
  const [copied, setCopied] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const myId = isServerMode() ? auth.me?.id : 'me'
  const [open, setOpen] = useState<Post | null>(null)
  const [writing, setWriting] = useState(false)
  const [toast, setToast] = useState('')
  const say = (m: string) => {
    setToast(m)
    setTimeout(() => setToast(''), 2400)
  }

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

      {isServerMode() && (
        <button className="write-fab btn btn-pink btn-block" onClick={() => setWriting(true)}>
          ✏️ {t('writePost')} <span className="write-fab-sub">🔒 {group.name} · {t('membersOnly')}</span>
        </button>
      )}
      <Composer group={group} onPosted={loadFeed} />
      {toast && <p className="board-toast">{toast}</p>}

      <section className="feed" aria-label="feed">
        {feed === null && <div className="board-msg">…</div>}
        {feed && feed.length === 0 && <p className="note center">{t('feedEmpty')}</p>}
        {feed?.map((p) => (
          <PostCard
            key={p.id}
            p={{ ...p, visibility: p.visibility ?? 'group', group_name: p.group_name ?? group.name, group_emoji: p.group_emoji ?? group.emoji }}
            myId={myId}
            canModerate={group.role === 'owner'}
            onChange={(next) => setFeed((f) => (f ? f.map((x) => (x.id === p.id ? next : x)) : f))}
            onRemoved={() => (isServerMode() ? loadFeed() : deletePost(p.id, group.id).then(loadFeed, loadFeed))}
            onOpen={isServerMode() ? () => setOpen(p) : undefined}
            onToast={say}
          />
        ))}
      </section>

      {open && <ThreadSheet postId={open.id} initial={open} groupOwner={group.role === 'owner'} onClose={() => setOpen(null)} onChanged={() => loadFeed()} />}
      {writing && (
        <WriteSheet
          groups={groups}
          preset={{ visibility: 'group', groupId: group.id }}
          onClose={() => setWriting(false)}
          onPosted={() => {
            setWriting(false)
            say(t('postedOk'))
            loadFeed()
          }}
        />
      )}

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

function Composer({ group, onPosted }: { group: Group; onPosted: () => void }) {
  const { t } = useApp()
  const describe = useDescribe()
  const options: BragData[] = useBragOptions()
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
