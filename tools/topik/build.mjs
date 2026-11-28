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
// 몽골어·아랍어 칸에는 한글을 넣지 않음 (scripts/check-mn·check-ar) → 괄호 안 한국어 문형 힌트만 빼고 설명은 남김
// 예) "арга, боломж (-ㄹ 수 있다 = чадах)" → "арга, боломж (чадах)", "-гүй (үгүйсгэл: -지 않다)" → "-гүй (үгүйсгэл)"
const HANGUL_TOKEN = /[-~/+]*[0-9]*[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A3][\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A30-9\-~/()]*/g
function noHangul(s) {
  const fixBracket = (inner) =>
    inner
      .replace(HANGUL_TOKEN, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\s+([,;:.])/g, '$1')
      .replace(/^[\s=+:;,]+|[\s=+:;,]+$/g, '')
      .replace(/:\s*=\s*/g, ': ')
      .trim()
  let t = String(s).replace(/\(([^()]*)\)/g, (m, inner) => {
    if (!/[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A3]/.test(inner)) return m
    const r = fixBracket(inner)
    return r ? `(${r})` : ''
  })
  t = t.replace(HANGUL_TOKEN, ' ').replace(/\s+/g, ' ').replace(/\s+([,;:.)])/g, '$1').replace(/\(\s*\)/g, '').trim().replace(/[,;]$/, '')
  return t
}
// 다른 코스에서 가져온 단어끼리 같은 그림이면 새 단원에서만 바꿈 (단원 안 그림 겹침 금지)
const EMOJI_OVERRIDE = { '2-core-07:휴일': '🏖️', '2-core-08:주스': '🧃' }
// 다른 코스에서 가져온 말인데 그쪽 뜻이 이 목록(빈도가 가장 높은 뜻)과 다른 것 → 이 단원에서만 뜻·그림·예문을 단어 id 로 따로 (다른 코스 카드는 그대로)
const SENSE_OVERRIDE = {
  '1-core-01:말': {
    lo: 'ຄຳເວົ້າ, ພາສາ', th: 'คำพูด, ภาษา', vi: 'lời nói, tiếng (ngôn ngữ)', mn: 'үг, хэл яриа', ar: 'كلام، لغة', emoji: '💬',
    ex: { ko: '그 말을 듣고 웃었어요.', rom: 'geu mareul deutgo useosseoyo.', lo: 'ຟັງຄຳເວົ້ານັ້ນແລ້ວກໍຫົວ', th: 'ได้ยินคำพูดนั้นแล้วก็หัวเราะ', vi: 'Nghe lời đó xong tôi đã cười.', mn: 'Тэр үгийг сонсоод инээсэн.', ar: 'سمعتُ ذلك الكلام فضحكت.' },
  },
  '1-core-04:못': {
    lo: 'ບໍ່ໄດ້ (ກ່ອນຄຳກິລິຍາ)', th: 'ไม่ได้ (หน้ากริยา)', vi: 'không thể (đứng trước động từ)', mn: 'чадахгүй (үйл үгийн өмнө)', ar: 'لا يستطيع (قبل الفعل)', emoji: '🚫',
    ex: { ko: '오늘은 바빠서 못 가요.', rom: 'oneureun bappaseo mot gayo.', lo: 'ມື້ນີ້ຫຍຸ້ງ ເລີຍໄປບໍ່ໄດ້', th: 'วันนี้ยุ่งเลยไปไม่ได้', vi: 'Hôm nay bận nên tôi không đi được.', mn: 'Өнөөдөр завгүй учраас явж чадахгүй.', ar: 'أنا مشغول اليوم فلا أستطيع الذهاب.' },
  },
  '1-core-06:새': {
    lo: 'ໃໝ່ (ກ່ອນຄຳນາມ)', th: 'ใหม่ (หน้าคำนาม)', vi: 'mới (đứng trước danh từ)', mn: 'шинэ (нэр үгийн өмнө)', ar: 'جديد (قبل الاسم)', emoji: '🆕',
    ex: { ko: '새 신발을 샀어요.', rom: 'sae sinbareul sasseoyo.', lo: 'ຊື້ເກີບໃໝ່', th: 'ซื้อรองเท้าใหม่', vi: 'Tôi đã mua giày mới.', mn: 'Шинэ гутал авсан.', ar: 'اشتريتُ حذاءً جديدًا.' },
  },
  '2-core-01:등': {
    lo: 'ແລະອື່ນໆ; ຫຼັງ (ຮ່າງກາຍ)', th: 'ฯลฯ, เป็นต้น; หลัง (ร่างกาย)', vi: 'v.v., vân vân; lưng', mn: 'гэх мэт; нуруу', ar: 'إلخ، وغيرها؛ ظَهْر', emoji: '🔙',
    ex: { ko: '사과, 배 등 과일을 샀어요.', rom: 'sagwa, bae deung gwaireul sasseoyo.', lo: 'ຊື້ໝາກໄມ້ ເຊັ່ນ ໝາກແອັບເປີ້ນ, ໝາກສາລີ່ ແລະອື່ນໆ', th: 'ซื้อผลไม้ เช่น แอปเปิล สาลี่ เป็นต้น', vi: 'Tôi đã mua trái cây như táo, lê v.v.', mn: 'Алим, лийр гэх мэт жимс авсан.', ar: 'اشتريتُ فواكه مثل التفاح والكمثرى وغيرها.' },
  },
  '2-core-02:병': {
    lo: 'ພະຍາດ; ຂວດ', th: 'โรค; ขวด', vi: 'bệnh; chai', mn: 'өвчин; шил (сав)', ar: 'مرض؛ زجاجة', emoji: '🤒',
    ex: { ko: '병이 나서 병원에 갔어요.', rom: 'byeongi naseo byeongwone gasseoyo.', lo: 'ບໍ່ສະບາຍ ເລີຍໄປໂຮງໝໍ', th: 'ป่วยเลยไปโรงพยาบาล', vi: 'Tôi bị bệnh nên đã đi bệnh viện.', mn: 'Өвдөөд эмнэлэг явсан.', ar: 'مرضتُ فذهبتُ إلى المستشفى.' },
  },
}
const coreFix = {}
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
    const id = `t-topik-${u.level}-${u.key}-${String(i + 1).padStart(2, '0')}`
    const so = SENSE_OVERRIDE[`${uk}:${w.ko}`]
    if (so) {
      coreFix[id] = { mn: so.mn, ar: so.ar }
      ex[id] = { ex: so.ex.ko, rom: so.ex.rom, lo: so.ex.lo, th: so.ex.th, vi: so.ex.vi, mn: so.ex.mn, ar: so.ex.ar }
      return [w.ko, w.rom, so.lo, so.th, so.vi, so.emoji]
    }
    if (w.status !== 'new') return [w.ko, w.rom, w.lo, w.th, w.vi, EMOJI_OVERRIDE[`${uk}:${w.ko}`] ?? w.emoji]
    const n = o.words[w.ko]
    mn[w.ko] = noHangul(n.mn)
    ar[w.ko] = noHangul(n.ar)
    ex[w.ko] = { ex: n.ex.ko, rom: n.ex.rom, lo: n.ex.lo, th: n.ex.th, vi: n.ex.vi }
    exmn[w.ko] = noHangul(n.ex.mn)
    exar[w.ko] = noHangul(n.ex.ar)
    return [w.ko, n.rom, n.lo, n.th, n.vi, n.emoji]
  })
  const phrases = o.phrases.map((p) => {
    mn[p.ko] = noHangul(p.mn)
    ar[p.ko] = noHangul(p.ar)
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
core += '/** 다른 코스와 뜻이 다른 같은 글자(말·못·새·등·병): 이 단원 카드의 몽골어·아랍어 (tr-fix.ts withFix 가 씀) */\n'
core += `export const TOPIK_CORE_FIX: Record<string, { mn: string; ar: string }> = {\n${Object.entries(coreFix).map(([a, b]) => `  ${q(a)}: { mn: ${q(b.mn)}, ar: ${q(b.ar)} },`).join('\n')}\n}\n\n`
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
console.log(`✓ 단원 ${plan.length}개 · 새 단어 ${Object.keys(ex).filter((k) => !k.startsWith('t-')).length} · 문장 ${plan.length * 5} · 옮긴 단어 ${Object.keys(idMoves).length} (예전 단원에서 뺀 줄 ${removed}, tr-fix 키 옮김 ${rekeyed})`)
