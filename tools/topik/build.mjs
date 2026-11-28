// TOPIK 새 단원 만들기: node tools/topik/build.mjs (저장소 루트에서, check.mjs 를 통과한 out-*.json 으로)
// → src/data/track-topik-core.ts (단원 + 옮긴 단어 id) · tr-mn-core.ts · tr-ar-core.ts · ex-topik-core.ts · exmn-core.ts · exar-core.ts
//   + track-topik-N.ts 에서 끝에 덧붙였던 단어(added) 빼기 · tr-fix.ts 의 단어 id 옮기기
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
const ROOT = process.cwd()
const WORK = `${process.env.CK_WORK || `${ROOT}/tools/_work`}/topik`
const load = async (f) => import(pathToFileURL(resolve(f)).href + `?t=${Date.now()}`)
const { plan, moved } = JSON.parse(readFileSync(`${WORK}/plan.json`, 'utf8'))
const out = {}
for (const f of readdirSync(WORK).filter((f) => /^out-\d+\.json$/.test(f)).sort()) Object.assign(out, JSON.parse(readFileSync(`${WORK}/${f}`, 'utf8')))
const q = (s) => `'${String(s).trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
const row = (r) => `[${r.map(q).join(', ')}]`
const CIRC = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'
const TITLE = { lo: 'ຄຳສັບຈຳເປັນ', th: 'คำศัพท์จำเป็น', vi: 'Từ vựng thiết yếu', mn: 'Зайлшгүй үгс', ar: 'كلمات أساسية' }
const mn = {}
const ar = {}
const ex = {}
const exmn = {}
const exar = {}
const units = {}
const missing = []
// 옮긴 단어의 예전 id: 그 단원의 단어 + 문장 다음 순서
const oldId = {}
for (const [lv, list] of Object.entries(moved)) {
  const src = Object.values(await load(`src/data/track-topik-${lv}.ts`))[0]
  const seenIn = {}
  for (const m of list) {
    const u = src.find((x) => x.key === m.from)
    seenIn[m.from] = (seenIn[m.from] ?? 0) + 1
    oldId[`${lv}:${m.row[0]}`] = `t-topik-${lv}-${m.from}-${String(u.words.length + u.phrases.length + seenIn[m.from]).padStart(2, '0')}`
  }
}
const idMoves = {}
for (const u of plan) {
  const uk = `${u.level}-${u.key}`
  const o = out[uk]
  if (!o) {
    missing.push(uk)
    continue
  }
  const k = Number(u.key.split('-')[1]) - 1
  const title = { ko: u.title, lo: `${TITLE.lo} ${CIRC[k]}`, th: `${TITLE.th} ${CIRC[k]}`, vi: `${TITLE.vi} ${CIRC[k]}` }
  mn[u.title] = `${TITLE.mn} ${CIRC[k]}`
  ar[u.title] = `${TITLE.ar} ${CIRC[k]}`
  const words = u.words.map((w, i) => {
    if (w.status === 'moved') idMoves[oldId[`${u.level}:${w.ko}`]] = `t-topik-${u.level}-${u.key}-${String(i + 1).padStart(2, '0')}`
    if (w.status !== 'new') return [w.ko, w.rom, w.lo, w.th, w.vi, w.emoji]
    const n = o.words[w.ko]
    mn[w.ko] = n.mn
    ar[w.ko] = n.ar
    ex[w.ko] = { ex: n.ex.ko, rom: n.ex.rom, lo: n.ex.lo, th: n.ex.th, vi: n.ex.vi }
    exmn[w.ko] = n.ex.mn
    exar[w.ko] = n.ex.ar
    return [w.ko, n.rom, n.lo, n.th, n.vi, n.emoji]
  })
  const phrases = o.phrases.map((p) => {
    mn[p.ko] = p.mn
    ar[p.ko] = p.ar
    return [p.ko, p.rom, p.lo, p.th, p.vi, p.emoji]
  })
  ;(units[u.level] ??= []).push({ key: u.key, title, words, phrases })
}
if (missing.length) {
  console.error(`✗ 아직 없는 단원: ${missing.join(', ')}`)
  process.exit(1)
}
const HEAD = (what) =>
  `// ${what} — tools/topik/build.mjs 가 만듦\n// 단어 목록: 국립국어원 「한국어 학습용 어휘 목록」(2003) 등급 A(초급) → 1·2급, B → 3·4급, C → 5·6급 (빈도 순)\n// 뜻·예문·문장: 이 앱에서 새로 씀 — ⚠️ 초안 (원어민 검수 전). 작업 파일(out-*.json)은 git 밖이라 고칠 때는 이 파일을 직접 고침\n`
let core = HEAD('TOPIK 필수 단어 단원 (급마다 25단어 + 문장 5개)') + "import type { TrackUnitSrc } from './track-types'\n\n"
core += '/** 예전 단원 끝에 덧붙였던 단어를 이 단원으로 옮김: 예전 id → 새 id (store 가 외운 기록을 옮김) */\n'
core += `export const TOPIK_ID_MOVES: Record<string, string> = {\n${Object.entries(idMoves).map(([a, b]) => `  ${q(a)}: ${q(b)},`).join('\n')}\n}\n\n`
core += 'export const TOPIK_CORE: Record<number, TrackUnitSrc[]> = {\n'
for (const [lv, us] of Object.entries(units)) {
  core += `  ${lv}: [\n`
  for (const u of us) {
    core += `    {\n      key: ${q(u.key)},\n      icon: '📌',\n      title: { ko: ${q(u.title.ko)}, lo: ${q(u.title.lo)}, th: ${q(u.title.th)}, vi: ${q(u.title.vi)} },\n`
    core += `      words: [\n${u.words.map((r) => `        ${row(r)},`).join('\n')}\n      ],\n`
    core += `      phrases: [\n${u.phrases.map((r) => `        ${row(r)},`).join('\n')}\n      ],\n    },\n`
  }
  core += '  ],\n'
}
core += '}\n'
writeFileSync('src/data/track-topik-core.ts', core)
const mapFile = (name, type, obj, what) => HEAD(what) + `export const ${name}: ${type} = {\n${Object.entries(obj).map(([k, v]) => `  ${q(k)}: ${typeof v === 'string' ? q(v) : `{ ${Object.entries(v).map(([a, b]) => `${a}: ${q(b)}`).join(', ')} }`},`).join('\n')}\n}\n`
writeFileSync('src/data/tr-mn-core.ts', mapFile('MN_CORE', 'Record<string, string>', mn, 'TOPIK 필수 단어 — 몽골어 (단어 · 문장 · 단원 제목)'))
writeFileSync('src/data/tr-ar-core.ts', mapFile('AR_CORE', 'Record<string, string>', ar, 'TOPIK 필수 단어 — 아랍어 (단어 · 문장 · 단원 제목)'))
writeFileSync('src/data/ex-topik-core.ts', "import type { ExampleMap } from './example-types'\n" + mapFile('EX_TOPIK_CORE', 'ExampleMap', ex, 'TOPIK 필수 단어 예문 (키 = 단어 한국어)').replace(/^(\/\/.*\n)+/, (h) => h))
writeFileSync('src/data/exmn-core.ts', mapFile('EXMN_CORE', 'Record<string, { mn: string; tip?: string }>', Object.fromEntries(Object.entries(exmn).map(([k, v]) => [k, { mn: v }])), 'TOPIK 필수 단어 예문 — 몽골어'))
writeFileSync('src/data/exar-core.ts', mapFile('EXAR_CORE', 'Record<string, { ar: string; tip?: string }>', Object.fromEntries(Object.entries(exar).map(([k, v]) => [k, { ar: v }])), 'TOPIK 필수 단어 예문 — 아랍어'))
// 예전 단원에서 덧붙인 단어 빼기
let removed = 0
for (const lv of Object.keys(moved)) {
  const f = `src/data/track-topik-${lv}.ts`
  const s = readFileSync(f, 'utf8')
  const t = s.replace(/\n    added: \[\n((?:      \{ row: .*\},?\n)+)    \],/g, (_, rows) => {
    removed += rows.trim().split('\n').length
    return ''
  })
  writeFileSync(f, t)
}
const want = Object.values(moved).reduce((a, l) => a + l.length, 0)
if (removed && removed !== want) console.error(`△ 뺀 단어 ${removed} ≠ 옮길 단어 ${want}`)
// tr-fix.ts: 옮긴 단어의 id-별 고침
let fix = readFileSync('src/data/tr-fix.ts', 'utf8')
let rekeyed = 0
for (const [a, b] of Object.entries(idMoves))
  if (fix.includes(`'${a}'`)) {
    fix = fix.replaceAll(`'${a}'`, `'${b}'`)
    rekeyed++
  }
writeFileSync('src/data/tr-fix.ts', fix)
console.log(`✓ 단원 ${plan.length}개 · 새 단어 ${Object.keys(ex).length} · 문장 ${plan.length * 5} · 옮긴 단어 ${Object.keys(idMoves).length} (예전 단원에서 뺀 줄 ${removed}, tr-fix 키 옮김 ${rekeyed})`)
