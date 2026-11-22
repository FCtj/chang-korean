// 커뮤니티 공통 조각: 글 카드 · 댓글 창 · 글쓰기 창 · 신고/차단/삭제 메뉴
// 전체 공개 글은 🌏 공개, 그룹 글은 🔒 그룹 이름 · 멤버만 으로 항상 구분해서 보여 줌
import { useEffect, useRef, useState } from 'react'
import { useApp } from '../ctx'
import { signInWithFacebook, useAuth } from '../backend'
import { learningRecord, useStore } from '../store'
import { TIERS, findRound } from '../data/words'
import { sfx } from '../audio'
import { burstFrom } from '../fx'
import { mascotOf, rankEmoji, tierName } from '../mascot'
import { Avatar } from '../ui'
import {
  CATEGORIES,
  REACTIONS,
  REPORT_REASONS,
  addComment,
  blockUser,
  createPost,
  deleteAnyPost,
  deleteComment,
  errorKey,
  isServerMode,
  postThread,
  reportContent,
  toggleReaction,
  type BragData,
  type Category,
  type Comment,
  type Group,
  type Post,
  type ReportReason,
  type Thread,
} from '../community'

type T = ReturnType<typeof useApp>['t']
type TF = ReturnType<typeof useApp>['tf']

/** 블랙 테마에서는 리본 배지 대신 초보 배지 */
export const tierBadge = (badge: string | undefined, theme: string) => (theme === 'carbon' && badge === '🎀' ? '🔰' : badge)
export const flagOf = (code?: string | null) => (code && /^[A-Z]{2}$/.test(code) && code !== 'ZZ' ? String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : '')

export function timeAgo(iso: string, t: T, tf: TF) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return t('justNow')
  if (min < 60) return tf('minsAgo', min)
  if (min < 60 * 24) return tf('hoursAgo', Math.floor(min / 60))
  return tf('daysAgo', Math.floor(min / 1440))
}

const catKey = (c: Category) => (({ question: 'catQuestion', study: 'catStudy', life: 'catLife', free: 'catFree' }) as const)[c]
export function CategoryChip({ c }: { c: Category }) {
  const { t } = useApp()
  const cat = CATEGORIES.find((x) => x.id === c)
  return (
    <span className={`cat-chip cat-${c}`}>
      {cat?.icon} {t(catKey(c))}
    </span>
  )
}

/** 🌏 공개 / 🔒 그룹 이름 · 멤버만 */
export function VisBadge({ p }: { p: Post }) {
  const { t } = useApp()
  if ((p.visibility ?? 'group') === 'public')
    return (
      <span className="vis-badge vis-public">
        <span aria-hidden="true">🌏</span> {t('badgePublic')}
      </span>
    )
  return (
    <span className="vis-badge vis-group">
      <span aria-hidden="true">🔒</span> {p.group_name ? `${p.group_emoji ?? ''} ${p.group_name} · ${t('membersOnly')}` : t('membersOnly')}
    </span>
  )
}

/** 자랑 문장: 데이터로 만들어서 보는 사람의 언어로 보여 줌 */
export function useDescribe() {
  const { tf, ui } = useApp()
  const { theme, country } = useStore()
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
        return { icon: rankEmoji(d.n ?? 1), text: `${tf('bragTier', d.n ?? 1)}${tr ? ` ${tierName(tr, mascotOf(country))![ui]}` : ''}` }
      }
      case 'step': {
        const r = d.unit ? findRound(d.unit) : undefined
        const unit = r ? (r.pack ? `${r.pack.icon} ${r.title[ui]}` : tf('roundN', r.no)) : ''
        return { icon: '✅', text: tf('bragStep', unit, d.n ?? 1) }
      }
      case 'pack': {
        const r = d.unit ? findRound(d.unit) : undefined
        return { icon: r?.pack?.icon ?? '🎒', text: tf('bragPack', r ? (r.title[ui] ?? r.title.ko) : '') }
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

/** ⋯ 메뉴: 삭제(내 것) · 신고 · 차단 */
function MoreMenu({ canDelete, canReport, onDelete, onReport, onBlock, onClose }: { canDelete: boolean; canReport: boolean; onDelete: () => void; onReport: (r: ReportReason) => void; onBlock: () => void; onClose: () => void }) {
  const { t } = useApp()
  const [step, setStep] = useState<'menu' | 'reason' | 'confirm'>('menu')
  const reasonKey = { spam: 'rSpam', abuse: 'rAbuse', sexual: 'rSexual', privacy: 'rPrivacy', other: 'rOther' } as const
  return (
    <div className="sheet-backdrop menu-backdrop" onClick={onClose}>
      <section className="sheet menu-sheet" role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" aria-hidden="true" />
        {step === 'menu' && (
          <>
            {canDelete && (
              <button className="menu-item danger" onClick={() => setStep('confirm')}>
                🗑️ {t('deleteIt')}
              </button>
            )}
            {canReport && (
              <button className="menu-item" onClick={() => setStep('reason')}>
                🚩 {t('report')}
              </button>
            )}
            {canReport && (
              <button className="menu-item" onClick={onBlock}>
                🚫 {t('block')}
              </button>
            )}
          </>
        )}
        {step === 'reason' && (
          <>
            <h3 className="h3">🚩 {t('reportWhy')}</h3>
            {REPORT_REASONS.map((r) => (
              <button key={r} className="menu-item" onClick={() => onReport(r)}>
                {t(reasonKey[r])}
              </button>
            ))}
          </>
        )}
        {step === 'confirm' && (
          <>
            <h3 className="h3">{t('confirmDelete')}</h3>
            <button className="menu-item danger" onClick={onDelete}>
              🗑️ {t('deleteIt')}
            </button>
          </>
        )}
        <button className="menu-item muted" onClick={onClose}>
          {t('cancel2')}
        </button>
      </section>
    </div>
  )
}

/** 글 카드 — 공개 글·그룹 글 공통. full = 댓글 창 안에서 전체 보기 */
export function PostCard({
  p,
  myId,
  full,
  canModerate,
  onChange,
  onRemoved,
  onOpen,
  onToast,
}: {
  p: Post
  myId?: string | null
  full?: boolean
  /** 그룹 방장: 다른 사람 글도 지우기 */
  canModerate?: boolean
  onChange: (p: Post) => void
  onRemoved: () => void
  onOpen?: () => void
  onToast?: (msg: string) => void
}) {
  const { t, tf } = useApp()
  const describe = useDescribe()
  const d = describe(p.data)
  const [menu, setMenu] = useState(false)
  const mine = !!myId && p.user_id === myId
  const server = isServerMode()
  const isPublic = (p.visibility ?? 'group') === 'public'
  return (
    <article className={`post ${p.verified ? 'verified' : ''} ${isPublic ? 'is-public' : 'is-group'}`}>
      <header className="post-head">
        <Avatar src={p.avatar} name={p.name} size={40} />
        <div className="post-who">
          <span className="post-name">
            {p.name} {p.country && <span className="post-flag">{flagOf(p.country)}</span>}
          </span>
          <span className="post-time">{timeAgo(p.created_at, t, tf)}</span>
        </div>
        {p.verified && <span className="verified-tag">✓ {t('verified')}</span>}
        {(server || mine) && (
          <button className="post-more" aria-label="⋯" onClick={() => setMenu(true)}>
            ⋯
          </button>
        )}
      </header>
      <div className="post-tags">
        <VisBadge p={p} />
        {p.category && <CategoryChip c={p.category} />}
      </div>
      {d && (
        <div className="brag-badge">
          <span className="brag-icon" aria-hidden="true">
            {d.icon}
          </span>
          <span className="brag-line">{d.text}</span>
        </div>
      )}
      {p.body && (
        <p className={full ? 'post-body full' : 'post-body'} dir="auto" onClick={onOpen} role={onOpen ? 'button' : undefined}>
          {p.body}
        </p>
      )}
      <div className="post-foot">
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
                  if (!server && isPublic) return onToast?.(t('loginToWrite'))
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
        {onOpen && p.comments !== undefined && (
          <button className="comment-btn" onClick={onOpen}>
            💬 <span className="num">{p.comments}</span>
            <span className="sr">{t('comments')}</span>
          </button>
        )}
      </div>
      {menu && (
        <MoreMenu
          canDelete={mine || !!canModerate}
          canReport={server && !mine}
          onClose={() => setMenu(false)}
          onDelete={async () => {
            setMenu(false)
            try {
              await deleteAnyPost(p.id)
              onRemoved()
            } catch {
              onToast?.(t('commError'))
            }
          }}
          onReport={async (r) => {
            setMenu(false)
            try {
              const hidden = await reportContent({ post: p.id }, r)
              onToast?.(t('reportedThanks'))
              if (hidden) onRemoved()
            } catch (e) {
              onToast?.(t(errorKey(e)))
            }
          }}
          onBlock={async () => {
            setMenu(false)
            try {
              await blockUser(p.user_id, true)
              onToast?.(t('blockedDone'))
              onRemoved()
            } catch (e) {
              onToast?.(t(errorKey(e)))
            }
          }}
        />
      )}
    </article>
  )
}

function CommentRow({ c, postMine, canModerate, onRemoved, onToast }: { c: Comment; postMine: boolean; canModerate: boolean; onRemoved: () => void; onToast: (m: string) => void }) {
  const { t, tf } = useApp()
  const [menu, setMenu] = useState(false)
  return (
    <li className="cmt">
      <Avatar src={c.avatar} name={c.name} size={32} />
      <div className="cmt-main">
        <div className="cmt-head">
          <span className="cmt-name">
            {c.name} {c.country && <span className="post-flag">{flagOf(c.country)}</span>}
          </span>
          <span className="post-time">{timeAgo(c.created_at, t, tf)}</span>
          <button className="post-more sm" aria-label="⋯" onClick={() => setMenu(true)}>
            ⋯
          </button>
        </div>
        <p className="cmt-body" dir="auto">
          {c.body}
        </p>
      </div>
      {menu && (
        <MoreMenu
          canDelete={c.mine || postMine || canModerate}
          canReport={!c.mine}
          onClose={() => setMenu(false)}
          onDelete={async () => {
            setMenu(false)
            try {
              await deleteComment(c.id)
              onRemoved()
            } catch {
              onToast(t('commError'))
            }
          }}
          onReport={async (r) => {
            setMenu(false)
            try {
              const hidden = await reportContent({ comment: c.id }, r)
              onToast(t('reportedThanks'))
              if (hidden) onRemoved()
            } catch (e) {
              onToast(t(errorKey(e)))
            }
          }}
          onBlock={async () => {
            setMenu(false)
            try {
              await blockUser(c.user_id, true)
              onToast(t('blockedDone'))
              onRemoved()
            } catch (e) {
              onToast(t(errorKey(e)))
            }
          }}
        />
      )}
    </li>
  )
}

/** 글 + 댓글 창 (아래에서 올라옴). 댓글 입력은 맨 아래 고정 */
export function ThreadSheet({ postId, initial, groupOwner, onClose, onChanged }: { postId: string; initial?: Post; groupOwner?: boolean; onClose: () => void; onChanged?: (p: Post | null) => void }) {
  const { t } = useApp()
  const auth = useAuth()
  const myId = auth.me?.id ?? null
  const [th, setTh] = useState<Thread | null>(initial ? { post: initial, comments: [] } : null)
  const [loaded, setLoaded] = useState(false)
  const [gone, setGone] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const listEnd = useRef<HTMLDivElement>(null)
  const say = (m: string) => {
    setToast(m)
    setTimeout(() => setToast(''), 2200)
  }
  const load = async (scroll = false) => {
    try {
      const next = await postThread(postId)
      setTh(next)
      setLoaded(true)
      onChanged?.(next.post)
      if (scroll) setTimeout(() => listEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50)
    } catch {
      setGone(true)
      setLoaded(true)
    }
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId])
  const send = async () => {
    const body = text.trim()
    if (!body || busy) return
    setBusy(true)
    try {
      await addComment(postId, body)
      setText('')
      sfx.pop()
      await load(true)
    } catch (e) {
      say(t(errorKey(e)))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="sheet thread-sheet" role="dialog" aria-label={t('comments')} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" aria-hidden="true" />
        <div className="thread-scroll">
          {gone && <p className="panel center-panel">{t('postGone')}</p>}
          {th && !gone && (
            <PostCard
              p={th.post}
              myId={myId}
              full
              canModerate={groupOwner}
              onChange={(p) => {
                setTh({ ...th, post: p })
                onChanged?.(p)
              }}
              onRemoved={() => {
                onChanged?.(null)
                onClose()
              }}
              onToast={say}
            />
          )}
          {th && !gone && (
            <section className="thread-comments" aria-label={t('comments')}>
              <h3 className="thread-h">
                💬 {t('comments')} <span className="num">{th.comments.length}</span>
              </h3>
              {loaded && th.comments.length === 0 && <p className="note">{t('noComments')}</p>}
              {!loaded && <div className="board-msg">…</div>}
              <ul className="cmt-list">
                {th.comments.map((c) => (
                  <CommentRow key={c.id} c={c} postMine={th.post.user_id === myId} canModerate={!!groupOwner} onRemoved={() => load()} onToast={say} />
                ))}
              </ul>
              <div ref={listEnd} />
            </section>
          )}
        </div>
        {toast && <div className="thread-toast">{toast}</div>}
        {!gone &&
          (auth.status === 'in' ? (
            <form
              className="cmt-input"
              onSubmit={(e) => {
                e.preventDefault()
                send()
              }}
            >
              <textarea className="input" rows={1} maxLength={500} placeholder={t('commentPh')} value={text} onChange={(e) => setText(e.target.value)} dir="auto" />
              <button className="btn btn-pink sm" type="submit" disabled={busy || !text.trim()}>
                {t('send')}
              </button>
            </form>
          ) : (
            <div className="cmt-input login">
              <span className="note">{t('loginToWrite')}</span>
              <button className="fb-btn sm" onClick={() => signInWithFacebook()}>
                <span className="fb-logo" aria-hidden="true">
                  f
                </span>{' '}
                {t('fbLogin')}
              </button>
            </div>
          ))}
      </section>
    </div>
  )
}

/** 글쓰기 창: 어디에 올릴지(🌏 전체 공개 / 🔒 내 그룹) 먼저 고름 */
export function WriteSheet({ groups, preset, onClose, onPosted }: { groups: Group[]; preset: { visibility: 'public' } | { visibility: 'group'; groupId: string }; onClose: () => void; onPosted: (where: { visibility: 'public' } | { visibility: 'group'; groupId: string }) => void }) {
  const { t } = useApp()
  const [where, setWhere] = useState(preset)
  const [cat, setCat] = useState<Category>('question')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const btn = useRef<HTMLButtonElement>(null)
  const isPublic = where.visibility === 'public'
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="sheet write-sheet" role="dialog" aria-label={t('writePost')} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" aria-hidden="true" />
        <h2 className="h3">✏️ {t('writePost')}</h2>
        <span className="label">{t('whoSees')}</span>
        <div className="where-list" role="radiogroup" aria-label={t('whoSees')}>
          <button role="radio" aria-checked={isPublic} className={isPublic ? 'where on public' : 'where public'} onClick={() => setWhere({ visibility: 'public' })}>
            <span className="where-icon" aria-hidden="true">
              🌏
            </span>
            <span className="where-text">
              <b>{t('commPublic')}</b>
              <small>{t('visPublicDesc')}</small>
            </span>
          </button>
          {groups.map((g) => {
            const on = where.visibility === 'group' && where.groupId === g.id
            return (
              <button key={g.id} role="radio" aria-checked={on} className={on ? 'where on group' : 'where group'} onClick={() => setWhere({ visibility: 'group', groupId: g.id })}>
                <span className="where-icon" aria-hidden="true">
                  🔒
                </span>
                <span className="where-text">
                  <b>
                    {g.emoji} {g.name}
                  </b>
                  <small>{t('visGroupDesc')}</small>
                </span>
              </button>
            )
          })}
        </div>
        {isPublic && (
          <>
            <span className="label">{t('categoryLabel')}</span>
            <div className="cat-pick" role="radiogroup" aria-label={t('categoryLabel')}>
              {CATEGORIES.map((c) => (
                <button key={c.id} role="radio" aria-checked={cat === c.id} className={cat === c.id ? 'cchip on' : 'cchip'} onClick={() => setCat(c.id)}>
                  {c.icon} {t(catKey(c.id))}
                </button>
              ))}
            </div>
          </>
        )}
        <textarea className="input write-text" rows={5} maxLength={1000} placeholder={t('postPh')} value={text} onChange={(e) => setText(e.target.value)} dir="auto" />
        <div className="write-meta">
          <span className="note">🔐 {t('noPersonal')}</span>
          <span className="note num">{text.length}/1000</span>
        </div>
        {err && <p className="note err">{err}</p>}
        <button
          ref={btn}
          className="btn btn-pink btn-block"
          disabled={busy || !text.trim()}
          onClick={async () => {
            setBusy(true)
            setErr('')
            try {
              await createPost(where.visibility, where.visibility === 'group' ? where.groupId : null, isPublic ? cat : null, text)
              sfx.pop()
              if (btn.current) burstFrom(btn.current, { count: 12 })
              onPosted(where)
            } catch (e) {
              setErr(t(errorKey(e)))
            } finally {
              setBusy(false)
            }
          }}
        >
          {isPublic ? '🌏' : '🔒'} {t('post')}
        </button>
      </section>
    </div>
  )
}

/** 그룹에서 '자랑하기' 고르기 (공부 기록 → 그룹에만) */
export function useBragOptions(): BragData[] {
  const s = useStore()
  const r = learningRecord(s)
  return [
    ...(r.words > 0 ? [{ type: 'words' as const, n: r.words }] : []),
    ...(r.streak > 0 ? [{ type: 'streak' as const, n: r.streak }] : []),
    ...(s.monthPoints > 0 ? [{ type: 'points' as const, n: s.monthPoints }] : []),
    { type: 'tier' as const, n: r.tier },
  ]
}
