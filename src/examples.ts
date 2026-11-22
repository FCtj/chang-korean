// 단어 예문: src/data/ex-*.ts 를 있는 만큼 불러옴 (처음 '?' 를 누를 때 한 번)
// 파일이 아직 없어도 앱은 그대로 동작 — 설명 창에 뜻만 보여 줌
import { useEffect, useState } from 'react'
import type { ExampleEntry, ExampleMap } from './data/example-types'

const files = import.meta.glob<Record<string, unknown>>('./data/ex-*.ts')
let cache: ExampleMap | null = null
let loading: Promise<ExampleMap> | null = null

export function loadExamples(): Promise<ExampleMap> {
  if (cache) return Promise.resolve(cache)
  if (!loading)
    loading = Promise.all(Object.values(files).map((load) => load().catch(() => ({}))))
      .then((mods) => {
        const map: ExampleMap = {}
        for (const mod of mods) for (const v of Object.values(mod)) if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(map, v)
        cache = map
        return map
      })
  return loading
}

export function useExample(ko: string | null): { entry: ExampleEntry | null; ready: boolean } {
  const [state, setState] = useState<{ entry: ExampleEntry | null; ready: boolean }>(() => ({ entry: ko && cache ? cache[ko] ?? null : null, ready: !!cache }))
  useEffect(() => {
    if (!ko) return
    let alive = true
    loadExamples().then((m) => alive && setState({ entry: m[ko] ?? null, ready: true }))
    return () => {
      alive = false
    }
  }, [ko])
  return state
}
