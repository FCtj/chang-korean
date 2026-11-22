// 계급 동물: 올라갈수록 귀여움 → 멋짐. 1 아기 병아리 · 2 깡총 토끼 · 3 꾀돌이 여우 · 4 용감한 호랑이 · 5 전설의 용
// 나라 마스코트(코끼리·물소·말·하이에나)는 앱의 친구로 그대로, 계급마다 내가 되는 동물이 달라짐
// 캔디 테마 = 파스텔 · 블랙 테마 = 메탈 몸 + 빛나는 눈 (ui.tsx 의 마스코트와 같은 느낌)
import { useId, type CSSProperties } from 'react'
import { useStore } from './store'

type P = { body: string; light: string; dark: string; accent: string; accent2: string; line: string; eye: string; blush: boolean }
// 블랙 테마 금속 색: 금 병아리 · 은 토끼 · 구리 여우 · 청동 호랑이 · 비취 용
const METAL: [string, string][] = [
  ['#a08a3c', '#2a2414'],
  ['#9aa3ae', '#262a30'],
  ['#a8603a', '#2a1a12'],
  ['#a07a34', '#281e10'],
  ['#2f9a80', '#0f2620'],
]
const CANDY: P[] = [
  { body: '#FFD54F', light: '#FFF1A8', dark: '#F5BF2E', accent: '#FF9F43', accent2: '#FFB86B', line: '#5B4366', eye: '#5B4366', blush: true }, // 병아리
  { body: '#FFFAFC', light: '#FFFFFF', dark: '#F1D6E1', accent: '#FFAFC8', accent2: '#FF8DB3', line: '#5B4366', eye: '#5B4366', blush: true }, // 토끼
  { body: '#FF9A3C', light: '#FFF4E6', dark: '#E5782A', accent: '#5B4366', accent2: '#FFE3C7', line: '#5B4366', eye: '#5B4366', blush: true }, // 여우
  { body: '#FFB547', light: '#FFF6E8', dark: '#E8962A', accent: '#5B4366', accent2: '#FFD9A0', line: '#5B4366', eye: '#3E2C48', blush: false }, // 호랑이
  { body: '#6FD3B8', light: '#E4FFF6', dark: '#3FB596', accent: '#FFD66B', accent2: '#F5B82E', line: '#2E5B52', eye: '#22343A', blush: false }, // 용
]

/** 계급 동물 그림. locked = 아직 못 간 계급 (회색) */
export function RankAnimal({ tier, size = 48, locked, className, style }: { tier: number; size?: number; locked?: boolean; className?: string; style?: CSSProperties }) {
  const theme = useStore().theme
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const n = Math.min(5, Math.max(1, tier)) - 1
  const carbon = theme === 'carbon'
  const c = CANDY[n]
  // 블랙 테마: 몸은 메탈 그라데이션, 포인트 색은 조금 차분하게, 눈은 빛남
  const body = carbon ? `url(#rb${id})` : c.body
  const light = carbon ? 'rgba(255,255,255,0.18)' : c.light
  const dark = carbon ? 'rgba(0,0,0,0.35)' : c.dark
  const line = carbon ? 'rgba(255,255,255,0.55)' : c.line
  const eye = carbon ? '#eef4ff' : c.eye
  const stroke = carbon ? 'rgba(255,255,255,0.16)' : n === 1 ? c.dark : 'none'
  const eyes = (y: number, cool = false) => (
    <g filter={carbon ? `url(#rg${id})` : undefined}>
      {cool ? (
        <>
          <ellipse cx="47" cy={y} rx="5" ry="5.6" fill={eye} />
          <ellipse cx="73" cy={y} rx="5" ry="5.6" fill={eye} />
          <path d={`M39 ${y - 10} l12 4 M81 ${y - 10} l-12 4`} stroke={carbon ? '#eef4ff' : c.line} strokeWidth="3.2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="47" cy={y} rx="5.2" ry="6.6" fill={eye} />
          <ellipse cx="73" cy={y} rx="5.2" ry="6.6" fill={eye} />
        </>
      )}
      {!carbon && (
        <>
          <circle cx="49" cy={y - 2.6} r="2" fill="#fff" />
          <circle cx="75" cy={y - 2.6} r="2" fill="#fff" />
        </>
      )}
    </g>
  )
  const blush = (y: number) => !carbon && c.blush && (
    <>
      <ellipse cx="35" cy={y} rx="6" ry="3.8" fill="#FF7FA8" opacity="0.45" />
      <ellipse cx="85" cy={y} rx="6" ry="3.8" fill="#FF7FA8" opacity="0.45" />
    </>
  )
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true" className={`rank-animal${locked ? ' locked' : ''}${className ? ` ${className}` : ''}`} style={style}>
      {carbon && (
        <defs>
          <linearGradient id={`rb${id}`} x1="0.2" y1="0" x2="0.6" y2="1">
            <stop offset="0" stopColor={METAL[n][0]} />
            <stop offset="1" stopColor={METAL[n][1]} />
          </linearGradient>
          <filter id={`rg${id}`} x="-60%" y="-200%" width="220%" height="500%">
            <feGaussianBlur stdDeviation="1.6" result="b" />
            <feFlood floodColor="#5b8cff" floodOpacity="0.9" />
            <feComposite in2="b" operator="in" result="g" />
            <feMerge>
              <feMergeNode in="g" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      )}

      {n === 0 && (
        <>
          {/* 🐣 병아리: 동글 몸 · 머리 깃털 · 부리 */}
          <path d="M60 34 C55 24 57 17 61 14 C63 21 64 27 60 34 Z" fill={body} stroke={stroke} />
          <path d="M60 35 C52 28 48 22 49 18 C55 21 59 27 60 35 Z" fill={dark} />
          <circle cx="60" cy="66" r="34" fill={body} stroke={stroke} strokeWidth="1.5" />
          <ellipse cx="60" cy="82" rx="20" ry="13" fill={light} />
          <ellipse cx="27" cy="74" rx="7" ry="12" fill={dark} transform="rotate(-18 27 74)" />
          <ellipse cx="93" cy="74" rx="7" ry="12" fill={dark} transform="rotate(18 93 74)" />
          {eyes(58)}
          {blush(68)}
          <path d="M52 67 L60 61 L68 67 L60 74 Z" fill={carbon ? '#e8b64a' : c.accent} />
          <path d="M52 67 H68" stroke={carbon ? '#9a7426' : c.accent2} strokeWidth="1.6" />
        </>
      )}

      {n === 1 && (
        <>
          {/* 🐰 토끼: 긴 귀 · 분홍 코 · ω 입 */}
          <path d="M44 44 C37 26 37 9 46 6 C55 8 55 26 53 42 Z" fill={body} stroke={stroke} strokeWidth="2" />
          <path d="M76 44 C83 26 83 9 74 6 C65 8 65 26 67 42 Z" fill={body} stroke={stroke} strokeWidth="2" />
          <path d="M46 38 C42 26 42 14 46 11 C50 13 50 26 49 37 Z" fill={carbon ? '#7b9bff' : c.accent} opacity="0.85" />
          <path d="M74 38 C78 26 78 14 74 11 C70 13 70 26 71 37 Z" fill={carbon ? '#7b9bff' : c.accent} opacity="0.85" />
          <ellipse cx="60" cy="70" rx="34" ry="30" fill={body} stroke={stroke} strokeWidth="2" />
          {eyes(64)}
          {blush(75)}
          <path d="M56 73 h8 l-4 4 z" fill={carbon ? '#7b9bff' : c.accent2} />
          <path d="M54 80 q3 4 6 0 q3 4 6 0" fill="none" stroke={line} strokeWidth="2" strokeLinecap="round" />
        </>
      )}

      {n === 2 && (
        <>
          {/* 🦊 여우: 뾰족 귀 · 흰 볼 · 까만 코 */}
          <path d="M28 48 L32 14 L56 38 Z" fill={body} />
          <path d="M92 48 L88 14 L64 38 Z" fill={body} />
          <path d="M34 40 L36 22 L48 36 Z" fill={carbon ? '#11141a' : c.accent2} />
          <path d="M86 40 L84 22 L72 36 Z" fill={carbon ? '#11141a' : c.accent2} />
          <path d="M24 54 Q28 34 60 34 Q92 34 96 54 Q98 74 80 88 Q70 96 60 96 Q50 96 40 88 Q22 74 24 54 Z" fill={body} />
          <path d="M26 62 Q42 62 52 76 Q57 86 60 94 Q48 94 39 86 Q28 76 26 62 Z" fill={light} />
          <path d="M94 62 Q78 62 68 76 Q63 86 60 94 Q72 94 81 86 Q92 76 94 62 Z" fill={light} />
          {eyes(58)}
          {blush(70)}
          <ellipse cx="60" cy="82" rx="5" ry="3.6" fill={carbon ? '#0c0e12' : c.accent} />
          <path d="M60 85 v3 M55 90 q5 3 10 0" fill="none" stroke={line} strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}

      {n === 3 && (
        <>
          {/* 🐯 호랑이: 둥근 귀 · 이마 王 줄무늬 · 짙은 눈썹 */}
          <circle cx="33" cy="38" r="11" fill={body} />
          <circle cx="87" cy="38" r="11" fill={body} />
          <circle cx="33" cy="38" r="5.5" fill={carbon ? '#11141a' : c.accent2} />
          <circle cx="87" cy="38" r="5.5" fill={carbon ? '#11141a' : c.accent2} />
          <circle cx="60" cy="65" r="34" fill={body} />
          <path d="M60 33 v10 M51 35 l2.5 8 M69 35 l-2.5 8" stroke={carbon ? '#0c0e12' : c.accent} strokeWidth="3.4" strokeLinecap="round" />
          <path d="M27 60 h10 M28 69 h8 M93 60 h-10 M92 69 h-8" stroke={carbon ? '#0c0e12' : c.accent} strokeWidth="3.2" strokeLinecap="round" />
          <ellipse cx="60" cy="80" rx="17" ry="12" fill={light} />
          {eyes(59, true)}
          <path d="M54 74 h12 l-6 6 z" fill={carbon ? '#0c0e12' : c.line} />
          <path d="M60 80 v3 M53 86 q7 4 14 0" fill="none" stroke={line} strokeWidth="2" strokeLinecap="round" />
        </>
      )}

      {n === 4 && (
        <>
          {/* 🐲 용: 금빛 뿔 · 등 가시 · 수염 · 자신만만한 미소 */}
          <path d="M44 38 C40 26 35 16 29 13 C38 12 47 23 50 35 Z" fill={carbon ? '#e6c35c' : c.accent} />
          <path d="M76 38 C80 26 85 16 91 13 C82 12 73 23 70 35 Z" fill={carbon ? '#e6c35c' : c.accent} />
          <path d="M50 36 L55 25 L60 34 L65 25 L70 36 Z" fill={dark} />
          <path d="M28 58 L13 50 L22 68 Z" fill={dark} />
          <path d="M92 58 L107 50 L98 68 Z" fill={dark} />
          <ellipse cx="60" cy="65" rx="34" ry="31" fill={body} />
          <circle cx="40" cy="44" r="2.4" fill={dark} />
          <circle cx="80" cy="44" r="2.4" fill={dark} />
          <circle cx="60" cy="40" r="2.4" fill={dark} />
          <ellipse cx="60" cy="81" rx="20" ry="12" fill={light} />
          {eyes(59, true)}
          <ellipse cx="54" cy="78" rx="2.2" ry="1.6" fill={line} />
          <ellipse cx="66" cy="78" rx="2.2" ry="1.6" fill={line} />
          <path d="M52 87 q9 5 17 -2" fill="none" stroke={line} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M40 82 q-12 1 -19 10 M80 82 q12 1 19 10" fill="none" stroke={carbon ? '#e6c35c' : c.accent2} strokeWidth="2.4" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}
