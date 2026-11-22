// 단어 예문: src/data/ex-*.ts 를 있는 만큼 불러옴 (처음 '?' 를 누를 때 한 번)
// 파일이 아직 없어도 앱은 그대로 동작 — 설명 창에 뜻만 보여 줌
import { useEffect, useState } from 'react'
import type { ExampleEntry, ExampleMap } from './data/example-types'

const files = import.meta.glob<Record<string, unknown>>('./data/ex-*.ts')
// 몽골어 예문 번역 (키 = 단어 한국어, 값 = { mn, tip? })
const mnFiles = import.meta.glob<Record<string, unknown>>('./data/exmn-*.ts')
export type MnExample = { mn: string; tip?: string }
type Loaded = { map: ExampleMap; mn: Record<string, MnExample> }
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
    ]).then(([mods, mnMods]) => {
      cache = { map: merge<ExampleEntry>(mods), mn: merge<MnExample>(mnMods) }
      return cache
    })
  return loading
}

type State = { entry: ExampleEntry | null; mn: MnExample | null; ready: boolean }
const pick = (c: Loaded | null, ko: string | null): State => ({ entry: ko && c ? c.map[ko] ?? null : null, mn: ko && c ? c.mn[ko] ?? null : null, ready: !!c })

export function useExample(ko: string | null): State {
  const [state, setState] = useState<State>(() => pick(cache, ko))
  useEffect(() => {
    if (!ko) return
    let alive = true
    loadExamples().then((c) => alive && setState(pick(c, ko)))
    return () => {
      alive = false
    }
  }, [ko])
  return state
}
