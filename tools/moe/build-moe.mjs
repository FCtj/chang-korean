// 교육부 기본 어휘 코스 만들기
//   영어: src/data/en/moe-1.ts(초등 *) · moe-2.ts(중·고 공통 **) · moe-3.ts(고교 선택) — 자주 쓰는 순 Day 단원
//   일본어: src/data/ja/moe-1.ts · moe-2.ts — 교육과정 기본 어휘표, 자주 쓰는 순 반씩
// 앱에 이미 있는 카드(뜻·그림·예문)는 그대로 쓰고, 없는 말은 work/*-out-*.json
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
const ROOT = process.cwd() // 저장소 루트에서 실행
const WORK = process.env.CK_WORK || `${ROOT}/tools/_work` // 내려받은 원본·중간 결과 (git 밖)
const D = `${WORK}/drive`
const SRC = `${ROOT}/src/data`
const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
const outs = (prefix, n) => {
  const o = {}
  for (let i = 1; i <= n; i++) if (existsSync(`${D}/work/${prefix}-out-${i}.json`)) Object.assign(o, JSON.parse(readFileSync(`${D}/work/${prefix}-out-${i}.json`, 'utf8')))
  return o
}

function units(list, keyPrefix) {
  const us = []
  let pending = [...list]
  while (pending.length) {
    const u = []
    const em = new Set()
    const mn = new Set()
    const rest = []
    for (const r of pending) {
      if (u.length < 25 && !em.has(r.row[3]) && !mn.has(r.row[2])) {
        u.push(r)
        em.add(r.row[3])
        mn.add(r.row[2])
      } else rest.push(r)
    }
    us.push(u)
    pending = rest
  }
  return us.map((u, i) => ({ key: `${keyPrefix}-${String(i + 1).padStart(2, '0')}`, title: `Day ${String(i + 1).padStart(2, '0')}`, words: u }))
}
function write(file, head, us) {
  let src = head + "import type { EdUnit, EdExampleMap } from '../edition-types'\n\nexport const UNITS: EdUnit[] = [\n"
  const ex = []
  for (const u of us) {
    src += `  {\n    key: ${q(u.key)},\n    icon: '📅',\n    title: ${q(u.title)},\n    words: [\n`
    for (const r of u.words) {
      src += `      [${r.row.map(q).join(', ')}],\n`
      ex.push(`  ${q(r.row[0])}: { ex: ${q(r.ex.ex)}, rom: ${q(r.ex.rom ?? '')}, ko: ${q(r.ex.ko)} },`)
    }
    src += `    ],\n    phrases: [],\n  },\n`
  }
  src += `]\n\nexport const EX: EdExampleMap = {\n${ex.join('\n')}\n}\n`
  writeFileSync(file, src)
  console.log(file.split('/data/')[1], us.length, 'units', us.reduce((a, u) => a + u.words.length, 0), 'words')
}

// ── 영어 ──
{
  const full = JSON.parse(readFileSync(`${D}/moe-en-full.json`, 'utf8'))
  const ipa = JSON.parse(readFileSync(`${D}/ipa-map.json`, 'utf8'))
  const neu = outs('en', 3)
  const lv = { '*': [], '**': [], '': [] }
  let skipped = 0
  for (const e of full) {
    let r
    if (e.have) r = { row: [...e.have.row], ex: e.have.ex, rank: e.rank }
    else {
      const o = neu[e.w]
      if (!o || o.skip || !ipa[e.w]) {
        skipped++
        continue
      }
      r = { row: [e.w, ipa[e.w], o.mean, o.emoji], ex: { ex: o.ex, rom: '', ko: o.exKo }, rank: e.rank }
    }
    if (!r.ex) {
      skipped++
      continue
    }
    lv[e.mark].push(r)
  }
  const HEAD = (what) => `// 영어판 — 교육부 기본 어휘 ${what} (출처 기반)
// 단어 목록: 교육부 고시 제2022-33호 [별책 14] 영어과 교육과정 [별표 3] 기본 어휘 (3,000개 · * 초등 800 · ** 중·고 공통 1,200 · 나머지 1,000)
// 순서: New General Service List 1.2 빈도 순 (자주 쓰는 말부터) · 발음(IPA): CMU Pronouncing Dictionary
// 뜻·예문(한국어): 이 앱에서 새로 씀 (초안) — 토익·생활 코스와 겹치는 단어는 같은 뜻·예문 · 자세한 출처: ./SOURCES.md
`
  ;[['*', 'moe-1', '초등 (*)', 'e1'], ['**', 'moe-2', '중·고 공통 (**)', 'e2'], ['', 'moe-3', '고교 선택', 'e3']].forEach(([m, f, what, k]) => {
    const list = lv[m].sort((a, b) => a.rank - b.rank)
    write(`${SRC}/en/${f}.ts`, HEAD(what), units(list, k))
  })
  console.log('en skipped', skipped)
}

// ── 일본어 ──
{
  const full = JSON.parse(readFileSync(`${D}/moe-ja-full.json`, 'utf8'))
  const neu = outs('ja', 1)
  const rows = []
  let skipped = 0
  for (const o of full) {
    if (o.have) {
      if (!o.have.ex) {
        skipped++
        continue
      }
      rows.push({ row: [...o.have.row], ex: o.have.ex, rank: o.rank })
      continue
    }
    const n = neu[o.term]
    if (!n || n.skip) {
      skipped++
      continue
    }
    rows.push({ row: [o.term, o.kana, n.mean, n.emoji], ex: { ex: n.ex, rom: n.rom, ko: n.exKo }, rank: o.rank })
  }
  rows.sort((a, b) => a.rank - b.rank)
  const half = Math.ceil(rows.length / 2 / 25) * 25
  const HEAD = (what) => `// 일본어판 — 교육과정 기본 어휘 ${what} (출처 기반)
// 단어 목록: 2022 개정 제2외국어과 교육과정 고등학교 「일본어」 [별표 Ⅰ] 기본 어휘표 (국제교류기금 일본어 번역판)
//   조사·조동사·접사(〜 · - 로 표시된 말)는 뺌 · 순서: Jiten 빈도 목록 (CC BY-SA 4.0) 자주 쓰는 순
// 뜻·예문(한국어): 이 앱에서 새로 씀 (초안) — JLPT·생활 코스와 겹치는 단어는 같은 뜻·예문 · 자세한 출처: ./SOURCES.md
`
  write(`${SRC}/ja/moe-1.ts`, HEAD('①'), units(rows.slice(0, half), 'j1'))
  write(`${SRC}/ja/moe-2.ts`, HEAD('②'), units(rows.slice(half), 'j2'))
  console.log('ja skipped', skipped)
}
