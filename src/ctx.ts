import { createContext, useContext } from 'react'
import type { Word } from './data/words'
import type { makeT, UiLang } from './i18n'

export type QuizKind = 'practice' | 'listen' | 'exam' | 'promo'

export type Route =
  | { name: 'tabs' }
  | { name: 'round'; roundId: string }
  | { name: 'track'; trackId: string }
  | { name: 'review' }
  | { name: 'player'; roundId: string; startChunk: number; review?: boolean }
  | { name: 'placement' }
  | { name: 'quiz'; kind: QuizKind; words: Word[]; pool: Word[]; roundId?: string; tierNo?: number; label: string }

export type Tab = 'learn' | 'community' | 'rewards' | 'settings'

export interface AppCtx {
  ui: UiLang
  t: ReturnType<typeof makeT>['t']
  tf: ReturnType<typeof makeT>['tf']
  push: (r: Route) => void
  pop: () => void
  replace: (r: Route) => void
  home: (tab?: Tab) => void
  tab: Tab
}

export const Ctx = createContext<AppCtx>(null as unknown as AppCtx)
export const useApp = () => useContext(Ctx)
