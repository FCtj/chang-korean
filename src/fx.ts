// 화려한 효과: 팡 터지는 별·하트, 떠오르는 점수, 콤보, 불꽃놀이
// DOM 요소를 잠깐 만들었다가 애니메이션이 끝나면 지움 (가볍게)
import { sfx } from './audio'

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

let host: HTMLDivElement | null = null
function layer(): HTMLDivElement {
  if (!host || !host.isConnected) {
    host = document.createElement('div')
    host.className = 'fx-layer'
    host.setAttribute('aria-hidden', 'true')
    document.body.appendChild(host)
  }
  return host
}

function spawn(cls: string, x: number, y: number, text: string, vars: Record<string, string>, life: number) {
  const el = document.createElement('span')
  el.className = cls
  el.textContent = text
  el.style.left = `${x}px`
  el.style.top = `${y}px`
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v)
  layer().appendChild(el)
  setTimeout(() => el.remove(), life)
}

const PARTY = ['⭐', '💖', '✨', '🌸', '💫', '🎀']
const COLORS = ['#FF8DB3', '#B9A6FF', '#7FD8C2', '#FFD66B', '#FFB59A', '#8CCBFF']

/** (x, y)에서 별·하트가 팡 터져 퍼짐 */
export function burst(x: number, y: number, opts: { count?: number; emojis?: string[]; power?: number } = {}) {
  if (reduced()) return
  const { count = 14, emojis = PARTY, power = 1 } = opts
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5
    const dist = (60 + Math.random() * 70) * power
    const useDot = i % 3 === 0
    spawn(
      useDot ? 'fx-dot' : 'fx-particle',
      x,
      y,
      useDot ? '' : emojis[i % emojis.length],
      {
        '--dx': `${Math.cos(angle) * dist}px`,
        '--dy': `${Math.sin(angle) * dist - 20 * power}px`,
        '--rot': `${Math.random() * 360 - 180}deg`,
        '--c': COLORS[i % COLORS.length],
        '--s': `${0.8 + Math.random() * 0.7}`,
      },
      900,
    )
  }
}

/** 요소 가운데에서 burst */
export function burstFrom(el: Element | null | undefined, opts?: Parameters<typeof burst>[2]) {
  if (!el) return
  const r = el.getBoundingClientRect()
  burst(r.left + r.width / 2, r.top + r.height / 2, opts)
}

/** 글자가 위로 떠오르며 사라짐 (예: +3 ⭐, 콤보 ×3!) */
export function floatText(text: string, x: number, y: number, kind: 'points' | 'combo' | 'big' = 'points') {
  spawn(`fx-float ${kind}`, x, y, text, {}, kind === 'big' ? 1800 : 1200)
}

export function floatFrom(el: Element | null | undefined, text: string, kind: 'points' | 'combo' | 'big' = 'points') {
  if (!el) return
  const r = el.getBoundingClientRect()
  floatText(text, r.left + r.width / 2, r.top, kind)
}

/** 화면 여기저기서 불꽃놀이 */
export function fireworks(shots = 6) {
  if (reduced()) return
  const w = window.innerWidth
  const h = window.innerHeight
  for (let i = 0; i < shots; i++) {
    setTimeout(() => {
      burst(w * (0.15 + Math.random() * 0.7), h * (0.12 + Math.random() * 0.4), { count: 18, power: 1.5, emojis: ['✨', '⭐', '💖', '🎉', '💫'] })
      if (i % 2 === 0) sfx.pop()
    }, i * 260)
  }
}

/** 화면 위에서 반짝이 비 */
export function sparkleRain(n = 26) {
  if (reduced()) return
  const w = window.innerWidth
  for (let i = 0; i < n; i++) {
    spawn('fx-rain', Math.random() * w, -30, PARTY[i % PARTY.length], { '--delay': `${Math.random() * 0.8}s`, '--dur': `${1.6 + Math.random() * 1.2}s`, '--rot': `${Math.random() * 720 - 360}deg` }, 3200)
  }
}
