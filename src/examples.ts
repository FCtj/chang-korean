// 단어 예문: src/data/ex-*.ts 를 있는 만큼 불러옴 (처음 '?' 를 누를 때 한 번)
// 파일이 아직 없어도 앱은 그대로 동작 — 설명 창에 뜻만 보여 줌
import { useEffect, useState } from 'react'
import type { ExampleEntry, ExampleMap } from './data/example-types'

const files = import.meta.glob<Record<string, unknown>>('./data/ex-*.ts')
// 몽골어 예문 번역 (키 = 단어 한국어, 값 = { mn, tip? })
const mnFiles = import.meta.glob<Record<string, unknown>>('./data/exmn-*.ts')
// 아랍어 예문 번역 (키 = 단어 한국어, 값 = { ar, tip? })
const arFiles = import.meta.glob<Record<string, unknown>>('./data/exar-*.ts')
export type MnExample = { mn: string; tip?: string }
export type ArExample = { ar: string; tip?: string }
type Loaded = { map: ExampleMap; mn: Record<string, MnExample>; ar: Record<string, ArExample> }
let cache: Loaded | null = null
let loading: Promise<Loaded> | null = null

const merge = <T,>(mods: Record<string, unknown>[]) => {
  const out: Record<string, T> = {}
  for (const mod of mods) for (const v of Object.values(mod)) if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, v)
  return out
}

export function loadExamples(): Promise<Loaded> {
  if (cache) return Promise.resolve(cache)
  if (!loading)
    loading = Promise.all([
      Promise.all(Object.values(files).map((load) => load().catch(() => ({})))),
      Promise.all(Object.values(mnFiles).map((load) => load().catch(() => ({})))),
      Promise.all(Object.values(arFiles).map((load) => load().catch(() => ({})))),
    ]).then(([mods, mnMods, arMods]) => {
      cache = { map: merge<ExampleEntry>(mods), mn: merge<MnExample>(mnMods), ar: merge<ArExample>(arMods) }
      return cache
    })
  return loading
}

type State = { entry: ExampleEntry | null; mn: MnExample | null; ar: ArExample | null; ready: boolean }
/** 같은 글자 다른 뜻(예: 팔 = 신체 / 숫자 8)은 단어 id 로 따로 둔 예문을 먼저 씀 — 그때는 글자로 찾은 몽골어·아랍어 예문을 쓰지 않음 */
const pick = (c: Loaded | null, ko: string | null, id?: string): State => {
  if (!ko || !c) return { entry: null, mn: null, ar: null, ready: !!c }
  const own = id ? c.map[id] : undefined
  if (own) return { entry: own, mn: null, ar: null, ready: true }
  return { entry: c.map[ko] ?? null, mn: c.mn[ko] ?? null, ar: c.ar[ko] ?? null, ready: true }
}

export function useExample(ko: string | null, id?: string): State {
  const [state, setState] = useState<State>(() => pick(cache, ko, id))
  useEffect(() => {
    if (!ko) return
    let alive = true
    loadExamples().then((c) => alive && setState(pick(c, ko, id)))
    return () => {
      alive = false
    }
  }, [ko, id])
  return state
}
