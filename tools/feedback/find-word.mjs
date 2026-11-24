// 수정 요청의 단어가 데이터 어디에 있는지 찾기 (저장소 루트에서)
//   node tools/feedback/find-word.mjs <ko|ja|en|lo> "<target>"
//   target = 관리자 화면/복사한 글의 '단어:' 칸 그대로 (예: "t-topik-1-d01-02 二") 또는 단어만 ("二", "안녕하세요")
// 판(ja·en·lo): 단어 id 로 정확한 레벨 파일·단원·줄을 찾고, 같은 말이 있는 다른 곳(예문 ① EX · 예문 ②③ ex-more)도 보여 줌
// 한국어판(ko): src/data/*.ts 에서 그 한국어가 나오는 곳 (단어 목록 · 번역 tr-* · 예문 ex-* · 고침 tr-fix/ex-curation)
import { readFileSync, readdirSync, existsSync } from 'node:fs'
const [app, ...rest] = process.argv.slice(2)
const target = rest.join(' ').trim()
if (!['ko', 'ja', 'en', 'lo'].includes(app) || !target) {
  console.error('사용: node tools/feedback/find-word.mjs <ko|ja|en|lo> "<단어 id 와 단어 또는 단어>"')
  process.exit(2)
}
const m = target.match(/^(t-(topik|daily)-(\d+)-([a-z0-9-]+?)-(\d{2}))\s+(.+)$/)
const term = (m ? m[6] : target.replace(/^\S+-\d{2}\s+/, '')).trim()
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
const show = (file, i, line) => console.log(`  ${file}:${i + 1}  ${line.trim().slice(0, 160)}`)
const grep = (files, needle) => {
  let n = 0
  for (const f of files) {
    const lines = readFileSync(f, 'utf8').split('\n')
    lines.forEach((l, i) => {
      if (l.includes(needle)) {
        n++
        if (n <= 60) show(f, i, l)
      }
    })
  }
  if (n > 60) console.log(`  … ${n - 60}곳 더`)
  return n
}

if (app !== 'ko') {
  const dir = `src/data/${app}`
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => `${dir}/${f}`)
  if (m) {
    // 단어 id → 레벨 파일: topik-N = index.ts LEVELS 의 N번째, daily-N = daily.ts DAILY 의 N번째
    const [, , kind, nStr, unitKey, posStr] = m
    const listFile = kind === 'topik' ? `${dir}/index.ts` : `${dir}/daily.ts`
    const src = readFileSync(listFile, 'utf8')
    const alias = Object.fromEntries([...src.matchAll(/import \* as (\w+) from '\.\/([\w-]+)\.ts'/g)].map((x) => [x[1], x[2]]))
    const arr = (src.match(/export const (?:LEVELS|DAILY)[^=]*=\s*\[([^\]]*)\]/) ?? [])[1] ?? ''
    const names = arr.split(',').map((s) => s.trim()).filter(Boolean)
    const fileName = alias[names[Number(nStr) - 1]]
    const file = fileName && `${dir}/${fileName}.ts`
    console.log(`■ 단어 id ${m[1]} → ${file ?? '(레벨 파일을 못 찾음)'} · 단원 '${unitKey}' · ${Number(posStr)}번째 (단어 다음에 문장 순서)`)
    if (file && existsSync(file)) {
      const lines = readFileSync(file, 'utf8').split('\n')
      const start = lines.findIndex((l) => l.includes(`key: '${unitKey}'`))
      if (start < 0) console.log('  단원을 못 찾음')
      else {
        // 그 단원의 words → phrases 순서로 행을 셈
        let k = 0
        for (let i = start; i < lines.length; i++) {
          if (i > start && /key: '/.test(lines[i])) break
          if (/^\s+\['/.test(lines[i])) {
            k++
            if (k === Number(posStr)) {
              show(file, i, lines[i])
              break
            }
          }
        }
      }
    }
  }
  console.log(`■ '${term}' 이 나오는 곳 (단어 행 · 예문 ① EX · 예문 ②③ ex-more)`)
  const n = grep(files, `'${esc(term)}'`)
  if (!n) console.log('  없음 — 글자가 다르면 단어만 다시 넣어 보기')
} else {
  const files = readdirSync('src/data').filter((f) => f.endsWith('.ts')).map((f) => `src/data/${f}`)
  console.log(`■ 한국어판 '${term}' 이 나오는 곳`)
  const n = grep(files, `'${esc(term)}'`)
  if (!n) console.log('  없음')
}
