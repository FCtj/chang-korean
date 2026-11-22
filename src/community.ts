// 커뮤니티: 전체 공개 게시판(누구나 읽기) + 내 그룹(멤버만) · 댓글 · 신고 · 차단
// - 서버가 연결되고 로그인했으면 Supabase (supabase/schema.sql 의 groups · posts · reactions + RPC)
// - 아니면 예시 그룹(지인들)과 이 기기에만 저장되는 글 (데모)
// 시험 통과(exam/promo)는 서버에서 자동으로 '인증' 글이 올라감 (point_events 트리거)
import { backendReady, getAuth, supabase } from './backend'
import { DEMO_PEOPLE } from './data/friends'
import { getState, todayKey } from './store'

export type PostKind = 'brag' | 'text' | 'achievement'
export type BragType = 'words' | 'streak' | 'points' | 'tier' | 'step' | 'pack' | 'exam' | 'promo'
export interface BragData {
  type?: BragType
  n?: number
  unit?: string
  score?: number
  ref?: string
  points?: number
}
export interface Group {
  id: string
  name: string
  emoji: string
  code: string
  owner: string
  member_count: number
  role: 'owner' | 'member'
}
export type Visibility = 'public' | 'group'
export type Category = 'question' | 'study' | 'life' | 'free'
export const CATEGORIES: { id: Category; icon: string }[] = [
  { id: 'question', icon: '❓' },
  { id: 'study', icon: '📚' },
  { id: 'life', icon: '💼' },
  { id: 'free', icon: '💬' },
]
export type ReportReason = 'spam' | 'abuse' | 'sexual' | 'privacy' | 'other'
export const REPORT_REASONS: ReportReason[] = ['spam', 'abuse', 'sexual', 'privacy', 'other']
export interface Post {
  id: string
  user_id: string
  name: string
  avatar: string | null
  kind: PostKind
  body: string
  data: BragData
  verified: boolean
  created_at: string
  reactions: Record<string, number>
  mine: string[]
  /** v2: 공개/그룹 · 그룹 이름 · 말머리 · 글쓴이 나라 · 댓글 수 */
  visibility?: Visibility
  group_id?: string | null
  group_name?: string | null
  group_emoji?: string | null
  category?: Category | null
  country?: string | null
  comments?: number
}
export interface Comment {
  id: string
  user_id: string
  name: string
  avatar: string | null
  country: string | null
  body: string
  created_at: string
  mine: boolean
}
export interface Thread {
  post: Post
  comments: Comment[]
}
export interface MyActivity {
  posts: { id: string; visibility: Visibility; group_name: string | null; group_emoji: string | null; category: Category | null; body: string; created_at: string; hidden: boolean; comments: number; last_comment_at: string | null }[]
  comments: { id: string; post_id: string; body: string; created_at: string; post_body: string; visibility: Visibility; group_name: string | null }[]
}
export interface Member {
  user_id: string
  name: string
  avatar: string | null
  country: string
  role: 'owner' | 'member'
  points: number
  me?: boolean
}
export const REACTIONS = ['👏', '🔥', '💪', '❤️', '😂'] as const
export const GROUP_EMOJIS = ['🐘', '📚', '🍜', '🇰🇷', '🏫', '💼', '✈️', '🎤']

/** 서버 모드인지 (아니면 데모) */
export function isServerMode(): boolean {
  return backendReady && getAuth().status === 'in'
}

/** 서버 오류 메시지 → 화면 문구 키 */
export function errorKey(e: unknown): 'codeNotFound' | 'groupFull' | 'tooManyGroups' | 'commError' | 'tooManyPosts' | 'tooManyComments' | 'postGone' {
  const m = String((e as { message?: string })?.message ?? e)
  if (m.includes('too_many_posts')) return 'tooManyPosts'
  if (m.includes('too_many_comments')) return 'tooManyComments'
  if (m.includes('not_found') && !m.includes('code')) return 'postGone'
  if (m.includes('not_found')) return 'codeNotFound'
  if (m.includes('full')) return 'groupFull'
  if (m.includes('too_many')) return 'tooManyGroups'
  return 'commError'
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase!.rpc(fn, args)
  if (error) throw error
  return data as T
}

// ───────── 데모 (이 기기 localStorage) ─────────
const KEY = 'chang-korean:community:v1'
const DEMO_GROUP_ID = 'demo-friends'
const DEMO_CODE = 'CHANG1'
const ME = 'me'

interface DemoDb {
  joined: string[]
  groups: Group[]
  posts: Record<string, Post[]>
  /** 내가 누른 반응 (예시 글 포함) */
  mine: Record<string, string[]>
}

const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString()
const person = (i: number) => DEMO_PEOPLE[i]
function seedPosts(): Post[] {
  // 지인들의 말을 지어내지 않도록, 예시 글은 앱이 만드는 기록(인증·자랑 템플릿)만 사용
  const P = (i: number, min: number, kind: PostKind, data: BragData, r: Record<string, number>, verified = kind === 'achievement'): Post => ({
    id: `seed-${i}-${min}`,
    user_id: `friend-${i}`,
    name: person(i).name,
    avatar: person(i).avatar,
    kind,
    body: '',
    data,
    verified,
    created_at: ago(min),
    reactions: r,
    mine: [],
  })
  return [
    P(0, 12, 'achievement', { type: 'exam', ref: 'r6', points: 100, score: 50 }, { '👏': 9, '🔥': 6, '❤️': 4 }),
    P(1, 47, 'brag', { type: 'streak', n: 21 }, { '🔥': 7, '💪': 3 }),
    P(2, 95, 'brag', { type: 'step', unit: 'r5', n: 3 }, { '👏': 5, '💪': 2 }),
    P(3, 180, 'achievement', { type: 'promo', ref: '2', points: 300 }, { '👏': 8, '🔥': 5, '😂': 1 }),
    P(4, 260, 'brag', { type: 'words', n: 250 }, { '👏': 4, '❤️': 2 }),
    P(1, 400, 'achievement', { type: 'exam', ref: 'r4', points: 100, score: 49 }, { '👏': 6, '🔥': 2 }),
    P(0, 720, 'brag', { type: 'points', n: 3400 }, { '🔥': 10, '👏': 4 }),
    P(10, 1300, 'brag', { type: 'pack', unit: 'p-work' }, { '💪': 3, '👏': 2 }),
  ]
}
function demoGroup(): Group {
  return { id: DEMO_GROUP_ID, name: 'Chang Korean Friends', emoji: '🐘', code: DEMO_CODE, owner: 'friend-0', member_count: DEMO_PEOPLE.length + 1, role: 'member' }
}
function loadDemo(): DemoDb {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as DemoDb
  } catch {
    /* 무시 */
  }
  // 처음 열면 예시 그룹에 들어가 있는 상태로 시작
  return { joined: [DEMO_GROUP_ID], groups: [], posts: { [DEMO_GROUP_ID]: [] }, mine: {} }
}
function saveDemo(db: DemoDb) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    /* 무시 */
  }
}
function meAsAuthor() {
  const s = getState()
  const me = getAuth().me
  return { user_id: ME, name: me?.name ?? s.nickname, avatar: me?.avatar || s.photo || null }
}
function demoGroups(db: DemoDb): Group[] {
  return [...(db.joined.includes(DEMO_GROUP_ID) ? [demoGroup()] : []), ...db.groups]
}
function demoCode(): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => A[Math.floor(Math.random() * A.length)]).join('')
}

// ───────── 공개 API ─────────

export async function myGroups(): Promise<Group[]> {
  if (isServerMode()) return rpc<Group[]>('my_groups')
  return demoGroups(loadDemo())
}

export async function createGroup(name: string, emoji: string): Promise<Group> {
  if (isServerMode()) return rpc<Group>('create_group', { p_name: name, p_emoji: emoji })
  const db = loadDemo()
  if (db.groups.length >= 10) throw new Error('too_many')
  const g: Group = { id: `local-${Date.now()}`, name: name.trim().slice(0, 30), emoji, code: demoCode(), owner: ME, member_count: 1, role: 'owner' }
  db.groups.push(g)
  db.posts[g.id] = []
  saveDemo(db)
  return g
}

export async function joinGroup(code: string): Promise<Group> {
  if (isServerMode()) return rpc<Group>('join_group', { p_code: code })
  const db = loadDemo()
  const c = code.trim().toUpperCase()
  if (c === DEMO_CODE) {
    if (!db.joined.includes(DEMO_GROUP_ID)) db.joined.push(DEMO_GROUP_ID)
    saveDemo(db)
    return demoGroup()
  }
  const own = db.groups.find((g) => g.code === c)
  if (own) return own
  throw new Error('not_found')
}

export async function leaveGroup(id: string): Promise<void> {
  if (isServerMode()) return rpc<void>('leave_group', { p_group: id })
  const db = loadDemo()
  db.joined = db.joined.filter((g) => g !== id)
  db.groups = db.groups.filter((g) => g.id !== id)
  delete db.posts[id]
  saveDemo(db)
}

export async function groupFeed(id: string): Promise<Post[]> {
  if (isServerMode()) return rpc<Post[]>('group_feed', { p_group: id, p_limit: 40 })
  const db = loadDemo()
  const mine = (db.posts[id] ?? []).map((p) => ({ ...p, ...meAsAuthor() }))
  const seeded = id === DEMO_GROUP_ID ? seedPosts() : []
  return [...mine, ...seeded]
    .map((p) => {
      const my = db.mine[p.id] ?? []
      const reactions = { ...p.reactions }
      for (const e of my) reactions[e] = (reactions[e] ?? 0) + 1
      return { ...p, reactions, mine: my }
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function groupRanking(id: string, period: 'week' | 'month'): Promise<Member[]> {
  if (isServerMode()) {
    const uid = getAuth().me?.id
    return (await rpc<Member[]>('group_ranking', { p_group: id, p_period: period })).map((m) => ({ ...m, me: m.user_id === uid }))
  }
  const s = getState()
  const me: Member = { ...meAsAuthor(), country: s.country, role: id === DEMO_GROUP_ID ? 'member' : 'owner', points: period === 'week' ? weekPointsGuess() : s.monthPoints, me: true }
  if (id !== DEMO_GROUP_ID) return [me]
  const day = new Date().getDate()
  const friends: Member[] = DEMO_PEOPLE.map((p, i) => {
    const month = Math.round(3400 * 0.88 ** i * Math.min(1, 0.25 + day / 30))
    return { user_id: `friend-${i}`, name: p.name, avatar: p.avatar, country: p.country, role: i === 0 ? 'owner' : 'member', points: period === 'week' ? Math.round(month / 4) : month }
  })
  return [...friends, me].sort((a, b) => b.points - a.points)
}

/** 데모: 이번 주 점수는 이번 달 점수 중 이번 주에 공부한 날 비율로 어림 */
function weekPointsGuess(): number {
  const s = getState()
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const from = todayKey(monday)
  const month = s.studyDays.filter((d) => d.slice(0, 7) === s.monthKey).length || 1
  const week = s.studyDays.filter((d) => d >= from).length
  return Math.round((s.monthPoints * week) / month)
}

export async function postBrag(groupId: string, body: string, data: BragData, kind: PostKind = 'brag'): Promise<void> {
  const text = body.trim().slice(0, 500)
  if (isServerMode()) {
    const { error } = await supabase!.from('posts').insert({ group_id: groupId, kind, body: text, data })
    if (error) throw error
    return
  }
  const db = loadDemo()
  const post: Post = { id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ...meAsAuthor(), kind, body: text, data, verified: kind === 'achievement', created_at: new Date().toISOString(), reactions: {}, mine: [] }
  db.posts[groupId] = [post, ...(db.posts[groupId] ?? [])].slice(0, 200)
  saveDemo(db)
}

export async function deletePost(postId: string, groupId: string): Promise<void> {
  if (isServerMode()) {
    const { error } = await supabase!.from('posts').delete().eq('id', postId)
    if (error) throw error
    return
  }
  const db = loadDemo()
  db.posts[groupId] = (db.posts[groupId] ?? []).filter((p) => p.id !== postId)
  saveDemo(db)
}

export async function toggleReaction(postId: string, emoji: string): Promise<boolean> {
  if (isServerMode()) return rpc<boolean>('toggle_reaction', { p_post: postId, p_emoji: emoji })
  const db = loadDemo()
  const cur = db.mine[postId] ?? []
  const on = !cur.includes(emoji)
  db.mine[postId] = on ? [...cur, emoji] : cur.filter((e) => e !== emoji)
  saveDemo(db)
  return on
}

/** 결과 화면의 '그룹에 자랑하기': 내 모든 그룹에 올림. 올린 그룹 수를 돌려줌 */
export async function shareToMyGroups(data: BragData, kind: PostKind = 'brag'): Promise<number> {
  const groups = await myGroups()
  await Promise.all(groups.map((g) => postBrag(g.id, '', data, kind)))
  return groups.length
}

/** 데모에서 시험 통과를 서버 트리거처럼 '인증' 글로 올림 (서버 모드에서는 서버가 자동으로 올림) */
export function demoAutoAchievement(data: BragData) {
  if (isServerMode()) return
  shareToMyGroups(data, 'achievement').catch(() => {})
}

/** 새 글이 올라오면 알려 줌 (서버 모드만) */
export function subscribeFeed(groupId: string, onChange: () => void): () => void {
  if (!isServerMode() || !supabase) return () => {}
  const ch = supabase
    .channel(`posts-${groupId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts', filter: `group_id=eq.${groupId}` }, onChange)
    .subscribe()
  return () => {
    supabase!.removeChannel(ch)
  }
}

// ───────── 전체 공개 게시판 · 댓글 · 신고 · 차단 (서버 전용, 읽기는 로그인 전에도) ─────────
export const boardReady = () => backendReady && !!supabase

export async function publicFeed(category: Category | null, country: string | null, before?: string): Promise<Post[]> {
  if (!boardReady()) return []
  return rpc<Post[]>('public_feed', { p_category: category, p_country: country, p_before: before ?? null, p_limit: 20 })
}
export async function createPost(visibility: Visibility, groupId: string | null, category: Category | null, body: string): Promise<string> {
  return rpc<string>('create_post', { p_visibility: visibility, p_group: groupId, p_category: category, p_body: body })
}
export async function postThread(postId: string): Promise<Thread> {
  return rpc<Thread>('post_thread', { p_post: postId })
}
export async function addComment(postId: string, body: string): Promise<string> {
  return rpc<string>('add_comment', { p_post: postId, p_body: body })
}
export async function deleteComment(commentId: string): Promise<void> {
  await rpc('delete_comment', { p_comment: commentId })
}
/** 신고 — 서로 다른 3명이 신고하면 숨김. 숨겨졌으면 true */
export async function reportContent(target: { post?: string; comment?: string }, reason: ReportReason): Promise<boolean> {
  return rpc<boolean>('report_content', { p_post: target.post ?? null, p_comment: target.comment ?? null, p_reason: reason })
}
export async function blockUser(userId: string, block: boolean): Promise<void> {
  await rpc('block_user', { p_user: userId, p_block: block })
}
export async function myBlocks(): Promise<{ user_id: string; name: string; avatar: string | null }[]> {
  return rpc('my_blocks')
}
export async function myActivity(): Promise<MyActivity> {
  return rpc<MyActivity>('my_activity')
}
/** 공개 글 지우기 (글쓴이만 — 서버 정책) */
export async function deleteAnyPost(postId: string): Promise<void> {
  const { error } = await supabase!.from('posts').delete().eq('id', postId)
  if (error) throw error
}
