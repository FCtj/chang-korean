// TOPIK 급 넓히기 1단계 일감: 국립국어원 학습용 어휘 A → 1·2급 새 단원(25+5), 검수 때 끝에 덧붙인 단어(added)를 빼서 모든 단원을 25+5 로
// 저장소 루트에서: node tools/topik/prep.mjs   → tools/_work/topik/plan.json · in-NN.json
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
const ROOT = process.cwd()
const WORK = `${process.env.CK_WORK || `${ROOT}/tools/_work`}/topik`
mkdirSync(WORK, { recursive: true })
const load = async (f) => import(pathToFileURL(resolve(f)).href)
const list = JSON.parse(readFileSync('tools/topik/data/klc-learner-vocab-2003.json', 'utf8'))
const { ROUNDS, PACKS } = await load('src/data/words.ts')
const { TRACKS } = await load('src/data/tracks.ts')
const appWords = new Map()
for (const r of [...ROUNDS, ...PACKS, ...TRACKS.flatMap((t) => t.units)]) for (const w of r.words) if (w.kind !== 'phrase' && !appWords.has(w.ko)) appWords.set(w.ko, w)
// TOPIK 원본 단원: 단어 · 문장 · 덧붙인 단어(added)
const topik = {}
const moved = {}
for (const n of [1, 2, 3, 4, 5, 6]) {
  const units = Object.values(await load(`src/data/track-topik-${n}.ts`))[0]
  topik[n] = units
  moved[n] = units.flatMap((u) => (u.added ?? []).filter((a) => !a.phrase).map((a) => ({ row: a.row, from: u.key })))
  if (units.some((u) => (u.added ?? []).some((a) => a.phrase))) throw new Error(`topik-${n}: 덧붙인 문장이 있음 — 처리 방법 정하기`)
}
const inTopik = new Set(Object.values(topik).flatMap((us) => us.flatMap((u) => [...u.words, ...u.phrases].map((r) => r[0]))))
const movedSet = new Set(Object.values(moved).flatMap((m) => m.map((x) => x.row[0])))
// 예문이 이미 있는 말
const exKeys = new Set()
const exmnKeys = new Set()
const exarKeys = new Set()
const exText = new Map()
for (const f of readdirSync('src/data')) {
  if (!f.endsWith('.ts')) continue
  const into = f.startsWith('exmn-') ? exmnKeys : f.startsWith('exar-') ? exarKeys : /^ex-/.test(f) ? exKeys : null
  if (!into) continue
  for (const v of Object.values(await load(`src/data/${f}`)))
    if (v && typeof v === 'object' && !Array.isArray(v))
      for (const [k, e] of Object.entries(v)) {
        into.add(k)
        // 예문 파일 안에 몽골어·아랍어가 같이 있는 경우도 있음
        if (into === exKeys && e && typeof e === 'object') {
          if (e.mn) exmnKeys.add(k)
          if (e.ar) exarKeys.add(k)
          if (e.ex && !exText.has(k)) exText.set(k, { ko: e.ex, lo: e.lo })
        }
      }
}
// 등급별 후보: 글자 하나에 하나 (빈도가 가장 높은 표제어), TOPIK 에 없는 것
const byGrade = { A: [], B: [], C: [] }
const seen = new Set()
for (const r of [...list].sort((a, b) => a.rank - b.rank)) {
  if (seen.has(r.base) || inTopik.has(r.base) || movedSet.has(r.base)) continue
  if (!/^[가-힣]+$/.test(r.base)) continue
  seen.add(r.base)
  const homo = list.filter((x) => x.base === r.base).map((x) => `${x.pos}${x.orig ? ' ' + x.orig : ''}(${x.grade})`)
  byGrade[r.grade]?.push({ ko: r.base, pos: r.pos, orig: r.orig, grade: r.grade, rank: r.rank, senses: homo })
}
const take = (g, n) => byGrade[g].splice(0, n)
// 급 구성 (단원 25개씩)
const item = (x) => {
  const w = appWords.get(x.ko)
  const base = { ko: x.ko, pos: x.pos ?? '', orig: x.orig ?? '', grade: x.grade ?? '', rank: x.rank ?? 0, senses: x.senses ?? [] }
  if (w) return { ...base, status: 'reuse', rom: w.rom, lo: w.lo, th: w.th, vi: w.vi, mn: w.mn, ar: w.ar, emoji: w.emoji, needEx: !exKeys.has(x.ko), needExMn: !exmnKeys.has(x.ko), needExAr: !exarKeys.has(x.ko), ex: exText.get(x.ko) }
  return { ...base, status: 'new', needEx: true, needExMn: true, needExAr: true }
}
const movedItem = (m) => {
  const w = appWords.get(m.row[0])
  const src = list.find((r) => r.base === m.row[0])
  return { ...item({ ko: m.row[0], pos: src?.pos, orig: src?.orig, grade: src?.grade, rank: src?.rank ?? 0 }), status: 'moved', from: m.from, rom: m.row[1], lo: m.row[2], th: m.row[3], vi: m.row[4], emoji: m.row[5], mn: w?.mn ?? '', ar: w?.ar ?? '' }
}
const A = take('A', byGrade.A.length)
const n1 = 11 * 25 - moved[1].length
const levels = {
  1: [...moved[1].map(movedItem), ...A.slice(0, n1).map(item)],
  2: [...moved[2].map(movedItem), ...A.slice(n1).map(item)],
}
const fill2 = 11 * 25 - levels[2].length
if (fill2 > 0) levels[2].push(...take('B', fill2).map(item))
if (fill2 < 0) throw new Error(`2급이 25×11 을 넘음: ${levels[2].length}`)
levels[3] = [...moved[3].map(movedItem), ...take('B', 25 - moved[3].length).map(item)]
levels[4] = [...moved[4].map(movedItem), ...take('B', 25 - moved[4].length).map(item)]
levels[5] = [...moved[5].map(movedItem), ...take('C', 25 - moved[5].length).map(item)]
// 급 안: 빈도 순 (덧붙였던 단어는 순위가 없으면 앞쪽)
const CIRC = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'
const plan = []
for (const [lv, items] of Object.entries(levels)) {
  items.sort((a, b) => (a.rank || 0) - (b.rank || 0))
  for (let i = 0; i < items.length; i += 25) {
    const k = i / 25
    plan.push({ level: Number(lv), key: `core-${String(k + 1).padStart(2, '0')}`, title: `필수 단어 ${CIRC[k]}`, words: items.slice(i, i + 25) })
  }
}
writeFileSync(`${WORK}/plan.json`, JSON.stringify({ plan, moved }, null, 1))
// 일감: 단원 3개씩
const per = 3
let n = 0
for (let i = 0; i < plan.length; i += per) {
  n++
  const chunk = plan.slice(i, i + per).map((u) => ({
    level: u.level,
    key: u.key,
    title: u.title,
    words: u.words.map((w) =>
      w.status === 'new'
        ? { ko: w.ko, pos: w.pos, orig: w.orig, senses: w.senses, status: 'new' }
        : {
            ko: w.ko,
            status: w.status,
            lo: w.lo,
            th: w.th,
            vi: w.vi,
            emoji: w.emoji,
            needEx: w.needEx,
            needExMn: w.needExMn,
            needExAr: w.needExAr,
            ...(!w.needEx && (w.needExMn || w.needExAr) ? { ex: w.ex } : {}),
          },
    ),
  }))
  writeFileSync(`${WORK}/in-${String(n).padStart(2, '0')}.json`, JSON.stringify(chunk, null, 1))
}
const count = (s) => plan.reduce((a, u) => a + u.words.filter((w) => w.status === s).length, 0)
const needEx = plan.reduce((a, u) => a + u.words.filter((w) => w.status !== 'new' && (w.needEx || w.needExMn || w.needExAr)).length, 0)
console.log(`단원 ${plan.length}개 (${Object.entries(levels).map(([l, it]) => `${l}급 +${it.length / 25}`).join(' · ')}) · 새 단어 ${count('new')} · 다른 코스에서 가져옴 ${count('reuse')} · 옮김 ${count('moved')} · 예문 더 써야 하는 기존 단어 ${needEx} · 일감 ${n}개`)
