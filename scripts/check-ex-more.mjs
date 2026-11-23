// 판의 예문 ②③ 검사 (npm test): src/data/<판>/ex-more.ts 의 EX_MORE
// - 키는 그 판 레벨 파일 EX(예문 ①) 에 있는 말 · 단어마다 예문 2개 · 형식(일본어: 가나 읽기, 한국어 번역)
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const load = async (f) => import(pathToFileURL(resolve(f)).href)
// 앱(ED_EXAMPLES)과 같은 순서: 두 번째 코스 먼저, 시험 코스가 같은 말을 덮어씀
const LEVEL_FILES = {
  ja: ['moe-1', 'moe-2', 'daily-1', 'daily-2', 'daily-3', 'n5', 'n4', 'n3'],
  en: ['moe-1', 'moe-2', 'moe-3', 'toeic-450', 'toeic-600', 'toeic-700', 'toeic-800', 'toeic-900'],
  lo: ['daily-1', 'daily-2', 'daily-3', 'level-1', 'freq-1', 'level-2', 'freq-2', 'level-3'],
}
const HANGUL = /[가-힣]/
const JA = /[぀-ヿ一-鿿]/
const KANA = /^[぀-ゟ゠-ヿー・\s、。？！「」『』〜～…（）()0-9０-９A-Za-zＡ-Ｚａ-ｚ,.?!%％]+$/
let errors = 0
const fail = (m) => (errors++, console.error('✗ ' + m))
for (const [ed, levels] of Object.entries(LEVEL_FILES)) {
  const f = `src/data/${ed}/ex-more.ts`
  if (!existsSync(f)) continue
  const { EX_MORE } = await load(f)
  const n = Object.keys(EX_MORE ?? {}).length
  if (!n) continue
  const ex1 = new Map()
  for (const l of levels) if (existsSync(`src/data/${ed}/${l}.ts`)) for (const [k, v] of Object.entries((await load(`src/data/${ed}/${l}.ts`)).EX ?? {})) ex1.set(k, v.ex)
  for (const [k, list] of Object.entries(EX_MORE)) {
    const at = `${ed} "${k}"`
    if (!ex1.has(k)) fail(`${at}: 레벨 파일 EX 에 없는 말`)
    if (!Array.isArray(list) || list.length !== 2) {
      fail(`${at}: 예문 ②③ 2개가 필요`)
      continue
    }
    const seen = new Set([ex1.get(k)])
    list.forEach((e, i) => {
      const w = `${at} 예문${i + 2}`
      if (!e?.ex?.trim() || !e?.ko?.trim()) return fail(`${w}: ex · ko 필요`)
      if (seen.has(e.ex)) fail(`${w}: 다른 예문과 똑같음`)
      seen.add(e.ex)
      if (!HANGUL.test(e.ko)) fail(`${w}: ko 는 한국어`)
      if (ed === 'ja') {
        if (!JA.test(e.ex) || HANGUL.test(e.ex)) fail(`${w}: ex 는 일본어`)
        if (!KANA.test(e.rom ?? '')) fail(`${w}: rom 은 가나 읽기`)
        if (e.ex.length > 45) fail(`${w}: ex 너무 김`)
      }
    })
  }
  console.log(`✓ ${ed} 예문 ②③: ${n}단어 · ${n * 2}문장 (예문 ① ${ex1.size}단어 중 ${Math.round((n / ex1.size) * 100)}%)`)
}
if (errors) {
  console.error(`\n예문 ②③ 문제 ${errors}개`)
  process.exit(1)
}
