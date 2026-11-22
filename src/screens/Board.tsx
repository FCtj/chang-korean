// 🌏 전체 공개 게시판 · 🙋 내 활동
// 공개 글은 로그인 없이도 읽기, 쓰기·댓글·반응은 Facebook 로그인 후
import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../ctx'
import { backendReady, signInWithFacebook, useAuth } from '../backend'
import { useStore } from '../store'
import { Avatar } from '../ui'
import { CATEGORIES, blockUser, boardReady, myActivity, myBlocks, myGroups, publicFeed, type Category, type Group, type MyActivity as Activity, type Post } from '../community'
import { CategoryChip, PostCard, ThreadSheet, WriteSheet, flagOf, timeAgo } from './communityParts'

const SEEN_KEY = 'ck-activity-seen'
export const readSeen = () => {
  try {
    return localStorage.getItem(SEEN_KEY) ?? ''
  } catch {
    return ''
  }
}
const markSeen = () => {
  try {
    localStorage.setItem(SEEN_KEY, new Date().toISOString())
  } catch {
    /* 이 기기에서 기억 못 함 */
  }
}
/** 내 글에 새 댓글이 달린 글 수 (마지막으로 '내 활동'을 본 뒤) */
export const newCommentCount = (a: Activity | null, seen: string) => (a ? a.posts.filter((p) => p.last_comment_at && p.last_comment_at > seen).length : 0)

const catKey = (c: Category) => (({ question: 'catQuestion', study: 'catStudy', life: 'catLife', free: 'catFree' }) as const)[c]

export function PublicBoard() {
  const { t } = useApp()
  const s = useStore()
  const auth = useAuth()
  const [cat, setCat] = useState<Category | null>(null)
  const [scope, setScope] = useState<'all' | 'country'>('all')
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [more, setMore] = useState(false)
  const [err, setErr] = useState(false)
  const [open, setOpen] = useState<Post | null>(null)
  const [writing, setWriting] = useState(false)
  const [groups, setGroups] = useState<Group[]>([])
  const [toast, setToast] = useState('')
  const myCountry = auth.me?.country ?? s.country
  const say = (m: string) => {
    setToast(m)
    setTimeout(() => setToast(''), 2400)
  }

  const load = useCallback(async () => {
    setErr(false)
    try {
      const rows = await publicFeed(cat, scope === 'country' ? myCountry : null)
      setPosts(rows)
      setMore(rows.length >= 20)
    } catch {
      setErr(true)
      setPosts([])
    }
  }, [cat, scope, myCountry])
  useEffect(() => {
    setPosts(null)
    load()
  }, [load, auth.status])
  useEffect(() => {
    if (auth.status === 'in') myGroups().then(setGroups, () => setGroups([]))
  }, [auth.status])

  const loadMore = async () => {
    const last = posts?.[posts.length - 1]
    if (!last) return
    const rows = await publicFeed(cat, scope === 'country' ? myCountry : null, last.created_at).catch(() => [])
    setPosts((p) => [...(p ?? []), ...rows])
    setMore(rows.length >= 20)
  }
  const replace = (p: Post) => setPosts((xs) => (xs ? xs.map((x) => (x.id === p.id ? p : x)) : xs))
  const remove = (id: string) => setPosts((xs) => (xs ? xs.filter((x) => x.id !== id) : xs))

  if (!boardReady()) return <p className="panel center-panel">{t('demoCommunity')}</p>

  return (
    <section className="board" aria-label={t('commPublic')}>
      <div className="board-rules">
        <b>📌 {t('rulesTitle')}</b>
        <span>{t('rulesBody')}</span>
      </div>

      {auth.status === 'in' ? (
        <button className="write-fab btn btn-pink btn-block" onClick={() => setWriting(true)}>
          ✏️ {t('writePost')} <span className="write-fab-sub">🌏 {t('commPublic')}</span>
        </button>
      ) : (
        <div className="panel login-write">
          <span>{t('loginToWrite')}</span>
          <button className="fb-btn" onClick={() => signInWithFacebook()}>
            <span className="fb-logo" aria-hidden="true">
              f
            </span>{' '}
            {t('fbLogin')}
          </button>
        </div>
      )}

      <div className="board-filters">
        <div className="cat-pick" role="radiogroup" aria-label={t('categoryLabel')}>
          <button role="radio" aria-checked={cat === null} className={cat === null ? 'cchip on' : 'cchip'} onClick={() => setCat(null)}>
            {t('catAll')}
          </button>
          {CATEGORIES.map((c) => (
            <button key={c.id} role="radio" aria-checked={cat === c.id} className={cat === c.id ? 'cchip on' : 'cchip'} onClick={() => setCat(c.id)}>
              {c.icon} {t(catKey(c.id))}
            </button>
          ))}
        </div>
        <div className="scope-pick" role="radiogroup" aria-label={t('country')}>
          <button role="radio" aria-checked={scope === 'all'} className={scope === 'all' ? 'scope on' : 'scope'} onClick={() => setScope('all')}>
            🌏 {t('allCountries')}
          </button>
          <button role="radio" aria-checked={scope === 'country'} className={scope === 'country' ? 'scope on' : 'scope'} onClick={() => setScope('country')}>
            {flagOf(myCountry) || '🏠'} {t('myCountryOnly')}
          </button>
          <button className="scope refresh" aria-label={t('retry')} onClick={() => load()}>
            ↻
          </button>
        </div>
      </div>

      {toast && <p className="board-toast">{toast}</p>}
      {err && (
        <p className="panel center-panel">
          {t('commError')}{' '}
          <button className="btn btn-soft sm" onClick={() => load()}>
            {t('retry')}
          </button>
        </p>
      )}
      {posts === null && <div className="board-msg">…</div>}
      {posts && posts.length === 0 && !err && <p className="panel center-panel">{t('noPostsYet')}</p>}
      <div className="feed">
        {posts?.map((p) => (
          <PostCard key={p.id} p={p} myId={auth.me?.id} onChange={replace} onRemoved={() => remove(p.id)} onOpen={() => setOpen(p)} onToast={say} />
        ))}
      </div>
      {more && (
        <button className="btn btn-soft btn-block" onClick={loadMore}>
          {t('loadMore')}
        </button>
      )}

      {open && <ThreadSheet postId={open.id} initial={open} onClose={() => setOpen(null)} onChanged={(p) => (p ? replace(p) : remove(open.id))} />}
      {writing && (
        <WriteSheet
          groups={groups}
          preset={{ visibility: 'public' }}
          onClose={() => setWriting(false)}
          onPosted={(where) => {
            setWriting(false)
            say(t('postedOk'))
            if (where.visibility === 'public') {
              setCat(null)
              load()
            }
          }}
        />
      )}
    </section>
  )
}

/** 🙋 내 활동: 내가 쓴 글(새 댓글 표시) · 내가 쓴 댓글 · 차단한 사람 */
export function MyActivityView({ onActivity }: { onActivity?: (a: Activity) => void }) {
  const { t, tf } = useApp()
  const auth = useAuth()
  const [a, setA] = useState<Activity | null>(null)
  const [blocks, setBlocks] = useState<{ user_id: string; name: string; avatar: string | null }[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [seen] = useState(readSeen)
  const load = useCallback(() => {
    myActivity().then(
      (x) => {
        setA(x)
        onActivity?.(x)
      },
      () => setA({ posts: [], comments: [] }),
    )
    myBlocks().then(setBlocks, () => setBlocks([]))
  }, [onActivity])
  useEffect(() => {
    if (auth.status !== 'in') return
    load()
    markSeen()
  }, [auth.status, load])

  if (backendReady && auth.status !== 'in')
    return (
      <section className="panel center-panel">
        <p>{t('loginToWrite')}</p>
        <button className="fb-btn" onClick={() => signInWithFacebook()}>
          <span className="fb-logo" aria-hidden="true">
            f
          </span>{' '}
          {t('fbLogin')}
        </button>
      </section>
    )
  if (!backendReady) return null
  return (
    <>
      <section className="panel my-act">
        <h2 className="h3">📝 {t('myPosts')}</h2>
        {a === null && <div className="board-msg">…</div>}
        {a && a.posts.length === 0 && <p className="note">{t('noPostsYet')}</p>}
        <ul className="myact-list">
          {a?.posts.map((p) => {
            const fresh = !!p.last_comment_at && p.last_comment_at > seen
            return (
              <li key={p.id}>
                <button className="myact-row" onClick={() => setOpen(p.id)}>
                  <span className="myact-tags">
                    {p.visibility === 'public' ? (
                      <span className="vis-badge vis-public">🌏 {t('badgePublic')}</span>
                    ) : (
                      <span className="vis-badge vis-group">
                        🔒 {p.group_emoji} {p.group_name}
                      </span>
                    )}
                    {p.category && <CategoryChip c={p.category} />}
                    {p.hidden && <span className="vis-badge vis-hidden">{t('hiddenTag')}</span>}
                  </span>
                  <span className="myact-body" dir="auto">
                    {p.body}
                  </span>
                  <span className="myact-meta">
                    <span>{timeAgo(p.created_at, t, tf)}</span>
                    <span className={fresh ? 'myact-cmt fresh' : 'myact-cmt'}>
                      💬 {p.comments}
                      {fresh && <b> · {t('newComments')}</b>}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="panel my-act">
        <h2 className="h3">💬 {t('myComments')}</h2>
        {a && a.comments.length === 0 && <p className="note">{t('noComments')}</p>}
        <ul className="myact-list">
          {a?.comments.map((c) => (
            <li key={c.id}>
              <button className="myact-row" onClick={() => setOpen(c.post_id)}>
                <span className="myact-tags">{c.visibility === 'public' ? <span className="vis-badge vis-public">🌏 {t('badgePublic')}</span> : <span className="vis-badge vis-group">🔒 {c.group_name}</span>}</span>
                <span className="myact-quote" dir="auto">
                  “{c.post_body}”
                </span>
                <span className="myact-body" dir="auto">
                  ↳ {c.body}
                </span>
                <span className="myact-meta">{timeAgo(c.created_at, t, tf)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {blocks.length > 0 && (
        <section className="panel my-act">
          <h2 className="h3">🚫 {t('blockedPeople')}</h2>
          <ul className="block-list">
            {blocks.map((b) => (
              <li key={b.user_id}>
                <Avatar src={b.avatar} name={b.name} size={32} />
                <span className="block-name">{b.name}</span>
                <button
                  className="btn btn-soft sm"
                  onClick={async () => {
                    await blockUser(b.user_id, false).catch(() => {})
                    setBlocks((xs) => xs.filter((x) => x.user_id !== b.user_id))
                  }}
                >
                  {t('unblock')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {open && <ThreadSheet postId={open} onClose={() => setOpen(null)} onChanged={() => load()} />}
    </>
  )
}
