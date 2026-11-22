import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useApp } from './ctx'
import { useStore } from './store'
import { mascotOf, type MascotKind } from './mascot'
import { localPron } from './pron'
import type { Native } from './data/words'

type IconName = 'users' | 'back' | 'play' | 'pause' | 'prev' | 'next' | 'speaker' | 'lock' | 'check' | 'gear' | 'gift' | 'minus' | 'plus' | 'home' | 'repeat' | 'skip' | 'heart' | 'trophy'

const PATHS: Record<IconName, ReactNode> = {
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
      <circle cx="16.5" cy="9.5" r="2.6" />
      <path d="M15.5 14.2c2.4-.2 4.4 1.3 5 4.3" />
    </>
  ),
  back: <path d="M15 5l-7 7 7 7" />,
  play: <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="currentColor" strokeLinejoin="round" />,
  pause: (
    <>
      <rect x="6.5" y="5" width="4" height="14" rx="2" fill="currentColor" stroke="none" />
      <rect x="13.5" y="5" width="4" height="14" rx="2" fill="currentColor" stroke="none" />
    </>
  ),
  prev: <path d="M16 6l-7 6 7 6" />,
  next: <path d="M8 6l7 6-7 6" />,
  skip: <path d="M6 6l6 6-6 6M13 6l6 6-6 6" />,
  speaker: (
    <>
      <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" fill="currentColor" />
      <path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="3" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
    </>
  ),
  gift: (
    <>
      <rect x="4" y="9" width="16" height="11" rx="2.5" />
      <path d="M3 9h18M12 9v11M12 9c-1.5-4-6-4-5.5-1.5S12 9 12 9zM12 9c1.5-4 6-4 5.5-1.5S12 9 12 9z" />
    </>
  ),
  home: <path d="M4 11l8-6.5 8 6.5M6.5 9.5V19h11V9.5" />,
  minus: <path d="M6 12h12" />,
  plus: <path d="M6 12h12M12 6v12" />,
  repeat: <path d="M17 4l3 3-3 3M4 11V9a2 2 0 012-2h14M7 20l-3-3 3-3M20 13v2a2 2 0 01-2 2H4" />,
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 01-8 0z" />
      <path d="M8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8.5 20h7M10 17h4" />
    </>
  ),
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" fill="currentColor" />,
}

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="icon">
      {PATHS[name]}
    </svg>
  )
}

// ───────── 마스코트: 나라별 (라오스·태국 = 코끼리 · 베트남 = 물소 · 몽골 = 말) ─────────
// 이름은 Elephant 그대로 (여러 화면에서 씀). 동물 머리만 바뀌고 눈·볼터치·장식은 같이 씀
export type Accessory = 'bow' | 'cap' | 'grad' | 'star' | 'crown' | 'none'
export const TIER_ACC: Accessory[] = ['bow', 'cap', 'grad', 'star', 'crown']

const TONES = {
  pink: { body: '#FFB9D0', ear: '#FF9DBE', line: '#F590B3', muzzle: '#FFDCE8', mane: '#A98CFF' },
  lilac: { body: '#CDBDFF', ear: '#B19BFA', line: '#A895F2', muzzle: '#E6DEFF', mane: '#FF8DB3' },
  grey: { body: '#E4DCE6', ear: '#D2C6D6', line: '#C9BCCD', muzzle: '#F1ECF2', mane: '#CDBFD1' },
}
type Tone = (typeof TONES)['pink']
type Mood = 'smile' | 'happy' | 'wow'

/** 지금 사용자 나라의 마스코트 */
export function useMascot(): MascotKind {
  return mascotOf(useStore().country)
}

export function Elephant({
  size = 72,
  acc = 'bow',
  mood = 'smile',
  tone = 'pink',
  kind,
  className,
  style,
}: {
  size?: number
  acc?: Accessory
  mood?: Mood
  tone?: keyof typeof TONES
  /** 안 주면 사용자 나라에 맞춤 */
  kind?: MascotKind
  className?: string
  style?: CSSProperties
}) {
  const s = useStore()
  const k = kind ?? mascotOf(s.country)
  if (s.theme === 'carbon') return <CarbonMascot kind={k} size={size} acc={acc} mood={mood} dim={tone === 'grey'} className={className} style={style} />
  const c = TONES[tone]
  const ink = '#5B4366'
  const blushY = k === 'elephant' ? 68 : 67
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true" className={className} style={style}>
      {k === 'buffalo' ? <BuffaloHead c={c} /> : k === 'horse' ? <HorseHead c={c} /> : <ElephantHead c={c} />}
      {/* 눈 */}
      {mood === 'happy' ? (
        <>
          <path d="M41 57 q6 -7 12 0" fill="none" stroke={ink} strokeWidth="3.6" strokeLinecap="round" />
          <path d="M67 57 q6 -7 12 0" fill="none" stroke={ink} strokeWidth="3.6" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="47" cy="56" rx={mood === 'wow' ? 6 : 5} ry={mood === 'wow' ? 7.5 : 6.4} fill={ink} />
          <ellipse cx="73" cy="56" rx={mood === 'wow' ? 6 : 5} ry={mood === 'wow' ? 7.5 : 6.4} fill={ink} />
          <circle cx="49" cy="53.5" r="2" fill="#fff" />
          <circle cx="75" cy="53.5" r="2" fill="#fff" />
          <circle cx="45.5" cy="58.5" r="0.9" fill="#fff" />
          <circle cx="71.5" cy="58.5" r="0.9" fill="#fff" />
        </>
      )}
      {/* 볼터치 */}
      <ellipse cx="36" cy={blushY} rx="6.5" ry="4" fill="#FF7FA8" opacity="0.45" />
      <ellipse cx="84" cy={blushY} rx="6.5" ry="4" fill="#FF7FA8" opacity="0.45" />
      <CandyAccessory acc={acc} />
    </svg>
  )
}

function ElephantHead({ c }: { c: Tone }) {
  return (
    <>
      {/* 귀 */}
      <ellipse cx="23" cy="58" rx="22" ry="27" fill={c.body} />
      <ellipse cx="97" cy="58" rx="22" ry="27" fill={c.body} />
      <ellipse cx="25" cy="60" rx="13" ry="17" fill={c.ear} opacity="0.6" />
      <ellipse cx="95" cy="60" rx="13" ry="17" fill={c.ear} opacity="0.6" />
      {/* 얼굴 */}
      <ellipse cx="60" cy="60" rx="34" ry="32" fill={c.body} />
      {/* 코 */}
      <path d="M60 74 C58 88 62 98 72 99 C78 99.5 81 95 79 91" fill="none" stroke={c.body} strokeWidth="13" strokeLinecap="round" />
      <path d="M55 85 q5 2.5 10 0 M57 92 q4.5 2.5 9 0" fill="none" stroke={c.line} strokeWidth="1.8" strokeLinecap="round" />
    </>
  )
}

/** 베트남: 물소 — 크게 휜 뿔 · 옆으로 난 귀 · 넓은 주둥이 */
function BuffaloHead({ c }: { c: Tone }) {
  const horn = '#FFF1D2'
  const hornLine = '#EBCB8E'
  return (
    <>
      {/* 뿔 */}
      <path d="M42 42 C26 42 12 34 13 13" fill="none" stroke={hornLine} strokeWidth="12" strokeLinecap="round" />
      <path d="M78 42 C94 42 108 34 107 13" fill="none" stroke={hornLine} strokeWidth="12" strokeLinecap="round" />
      <path d="M42 42 C26 42 12 34 13 13" fill="none" stroke={horn} strokeWidth="8.5" strokeLinecap="round" />
      <path d="M78 42 C94 42 108 34 107 13" fill="none" stroke={horn} strokeWidth="8.5" strokeLinecap="round" />
      <path d="M22 37 l5 -4 M17 29 l5 -3 M98 37 l-5 -4 M103 29 l-5 -3" stroke={hornLine} strokeWidth="1.6" strokeLinecap="round" />
      {/* 귀 */}
      <ellipse cx="22" cy="57" rx="15" ry="8" transform="rotate(-20 22 57)" fill={c.body} />
      <ellipse cx="98" cy="57" rx="15" ry="8" transform="rotate(20 98 57)" fill={c.body} />
      <ellipse cx="23" cy="57" rx="9" ry="4.2" transform="rotate(-20 23 57)" fill={c.ear} opacity="0.65" />
      <ellipse cx="97" cy="57" rx="9" ry="4.2" transform="rotate(20 97 57)" fill={c.ear} opacity="0.65" />
      {/* 얼굴 */}
      <ellipse cx="60" cy="60" rx="33" ry="32" fill={c.body} />
      {/* 앞머리 */}
      <path d="M48 33 q5 -9 12 -3 q7 -6 12 3 q-6 -2 -12 3 q-6 -5 -12 -3 Z" fill={c.ear} />
      {/* 주둥이 */}
      <ellipse cx="60" cy="82" rx="24" ry="14.5" fill={c.muzzle} />
      <ellipse cx="51.5" cy="81" rx="2.8" ry="3.6" fill={c.line} />
      <ellipse cx="68.5" cy="81" rx="2.8" ry="3.6" fill={c.line} />
      <path d="M54 89 q6 4 12 0" fill="none" stroke={c.line} strokeWidth="2" strokeLinecap="round" />
    </>
  )
}

/** 몽골: 말 — 길쭉한 얼굴 · 쫑긋한 귀 · 옆으로 넘긴 갈기 */
const HORSE_FACE = 'M60 25 C80 25 90 39 89 57 C88 69 84 77 82 86 C80 98 72 105 60 105 C48 105 40 98 38 86 C36 77 32 69 31 57 C30 39 40 25 60 25 Z'
const HORSE_MANE_BACK = 'M70 24 C96 26 106 52 99 80 C97 90 93 96 88 100 C92 84 92 66 84 50 Z'
const HORSE_FORELOCK = 'M40 34 C42 20 54 14 66 17 C76 19 82 27 82 35 C77 30 71 30 66 34 C62 28 55 29 51 35 C47 31 43 31 40 34 Z'
function HorseHead({ c }: { c: Tone }) {
  return (
    <>
      {/* 갈기 (뒤) */}
      <path d={HORSE_MANE_BACK} fill={c.mane} />
      {/* 귀: 길고 뾰족 */}
      <path d="M41 38 L35 5 L56 27 Z" fill={c.body} strokeLinejoin="round" />
      <path d="M79 38 L85 5 L64 27 Z" fill={c.body} strokeLinejoin="round" />
      <path d="M42 31 L38 13 L50 26 Z" fill={c.ear} opacity="0.7" />
      <path d="M78 31 L82 13 L70 26 Z" fill={c.ear} opacity="0.7" />
      {/* 얼굴 */}
      <path d={HORSE_FACE} fill={c.body} />
      {/* 코끝 (조금 진하게) */}
      <ellipse cx="60" cy="93" rx="21" ry="11.5" fill={c.ear} opacity="0.4" />
      <ellipse cx="51.5" cy="92" rx="2.2" ry="3.8" transform="rotate(-22 51.5 92)" fill={c.line} />
      <ellipse cx="68.5" cy="92" rx="2.2" ry="3.8" transform="rotate(22 68.5 92)" fill={c.line} />
      <path d="M55 99.5 q5 3 10 0" fill="none" stroke={c.line} strokeWidth="1.8" strokeLinecap="round" />
      {/* 앞머리 */}
      <path d={HORSE_FORELOCK} fill={c.mane} />
    </>
  )
}

function CandyAccessory({ acc }: { acc: Accessory }) {
  return (
    <>
      {acc === 'bow' && (
        <g transform="translate(82 30) rotate(18)">
          <path d="M0 0 L-13 -8 Q-16 0 -13 8 Z" fill="#FF6F9F" />
          <path d="M0 0 L13 -8 Q16 0 13 8 Z" fill="#FF6F9F" />
          <circle r="4.5" fill="#FF4F8B" />
        </g>
      )}
      {acc === 'cap' && (
        <g>
          <path d="M37 37 Q60 12 83 37 Z" fill="#7FD8C2" />
          <rect x="72" y="33" width="22" height="6.5" rx="3.2" fill="#5CC4AA" />
          <circle cx="60" cy="21" r="3.5" fill="#FFD66B" />
        </g>
      )}
      {acc === 'grad' && (
        <g>
          <rect x="47" y="27" width="26" height="11" rx="3" fill="#7A66DA" />
          <polygon points="60,13 94,25 60,37 26,25" fill="#8F7BEA" />
          <path d="M88 26 v13" stroke="#FFD66B" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="88" cy="41" r="3" fill="#FFD66B" />
        </g>
      )}
      {acc === 'star' && (
        <polygon
          transform="translate(60 22)"
          points="0,-13 3.8,-4.2 13,-4 5.8,2 8.2,11 0,5.8 -8.2,11 -5.8,2 -13,-4 -3.8,-4.2"
          fill="#FFD66B"
          stroke="#F5B83D"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      )}
      {acc === 'crown' && (
        <g>
          <path d="M40 36 L43 17 L52 27 L60 12 L68 27 L77 17 L80 36 Z" fill="#FFD66B" stroke="#F5B83D" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="60" cy="29" r="3" fill="#FF6F9F" />
          <circle cx="49" cy="31" r="2.2" fill="#8FD3FF" />
          <circle cx="71" cy="31" r="2.2" fill="#8FD3FF" />
        </g>
      )}
    </>
  )
}

/** 블랙 테마: 그래파이트 금속 몸 + 헤드라이트 같은 눈 */
function CarbonMascot({ kind, size, acc, mood, dim, className, style }: { kind: MascotKind; size: number; acc: Accessory; mood: Mood; dim: boolean; className?: string; style?: CSSProperties }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const body = dim ? ['#30343b', '#1b1e23'] : ['#555d69', '#1c2026']
  const eye = dim ? '#5f6670' : '#eef4ff'
  const glow = dim ? undefined : `url(#cg${id})`
  const silver = '#d9dde3'
  const B = `url(#cb${id})`
  const E = `url(#ce${id})`
  const H = `url(#ch${id})`
  const edge = 'rgba(255,255,255,0.14)'
  const muzzle = dim ? '#25282d' : '#2c3138'
  const nostril = 'rgba(255,255,255,0.3)'
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true" className={className} style={style}>
      <defs>
        <linearGradient id={`cb${id}`} x1="0.2" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor={body[0]} />
          <stop offset="1" stopColor={body[1]} />
        </linearGradient>
        <linearGradient id={`ce${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={dim ? '#2a2e34' : '#3d434d'} />
          <stop offset="1" stopColor="#111317" />
        </linearGradient>
        <linearGradient id={`ch${id}`} x1="0" y1="1" x2="0.4" y2="0">
          <stop offset="0" stopColor={dim ? '#3a3f46' : '#7d8590'} />
          <stop offset="1" stopColor={dim ? '#555b63' : '#eef1f5'} />
        </linearGradient>
        <filter id={`cg${id}`} x="-60%" y="-200%" width="220%" height="500%">
          <feGaussianBlur stdDeviation="1.8" result="b" />
          <feFlood floodColor="#5b8cff" floodOpacity="0.9" />
          <feComposite in2="b" operator="in" result="g" />
          <feMerge>
            <feMergeNode in="g" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {kind === 'buffalo' ? (
        <>
          {/* 뿔: 은색 */}
          <path d="M42 42 C26 42 12 34 13 13" fill="none" stroke={H} strokeWidth="10" strokeLinecap="round" />
          <path d="M78 42 C94 42 108 34 107 13" fill="none" stroke={H} strokeWidth="10" strokeLinecap="round" />
          <ellipse cx="22" cy="57" rx="15" ry="8" transform="rotate(-20 22 57)" fill={E} stroke={edge} strokeWidth="1" />
          <ellipse cx="98" cy="57" rx="15" ry="8" transform="rotate(20 98 57)" fill={E} stroke={edge} strokeWidth="1" />
          <ellipse cx="60" cy="60" rx="33" ry="32" fill={B} />
          <path d="M35 47 Q46 32 66 31" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="2.2" strokeLinecap="round" />
          <ellipse cx="60" cy="82" rx="24" ry="14.5" fill={muzzle} stroke={edge} strokeWidth="1" />
          <ellipse cx="51.5" cy="81" rx="2.6" ry="3.4" fill={nostril} />
          <ellipse cx="68.5" cy="81" rx="2.6" ry="3.4" fill={nostril} />
        </>
      ) : kind === 'horse' ? (
        <>
          {/* 갈기: 검은 리본 */}
          <path d={HORSE_MANE_BACK} fill="#0d0f12" stroke={edge} strokeWidth="1" />
          <path d="M41 38 L35 5 L56 27 Z" fill={E} stroke={edge} strokeWidth="1" strokeLinejoin="round" />
          <path d="M79 38 L85 5 L64 27 Z" fill={E} stroke={edge} strokeWidth="1" strokeLinejoin="round" />
          <path d={HORSE_FACE} fill={B} />
          <path d="M36 48 Q44 33 62 30" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="2.2" strokeLinecap="round" />
          <ellipse cx="60" cy="93" rx="21" ry="11.5" fill={muzzle} stroke={edge} strokeWidth="1" />
          <ellipse cx="51.5" cy="92" rx="2.1" ry="3.6" transform="rotate(-22 51.5 92)" fill={nostril} />
          <ellipse cx="68.5" cy="92" rx="2.1" ry="3.6" transform="rotate(22 68.5 92)" fill={nostril} />
          <path d={HORSE_FORELOCK} fill="#0d0f12" stroke={edge} strokeWidth="1" />
        </>
      ) : (
        <>
          {/* 귀: 날렵한 패널 */}
          <path d="M40 38 C22 22 2 32 3 56 C4 80 22 92 38 80 Z" fill={E} stroke={edge} strokeWidth="1" />
          <path d="M80 38 C98 22 118 32 117 56 C116 80 98 92 82 80 Z" fill={E} stroke={edge} strokeWidth="1" />
          <path d="M12 50 C14 40 22 36 30 38" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M108 50 C106 40 98 36 90 38" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.4" strokeLinecap="round" />
          {/* 얼굴 */}
          <ellipse cx="60" cy="58" rx="33" ry="31" fill={B} />
          <path d="M35 46 Q46 31 66 30" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="2.2" strokeLinecap="round" />
          {/* 이마 엠블럼 */}
          <rect x="55" y="38" width="10" height="2.6" rx="1.3" fill={dim ? '#4a5058' : 'rgba(255,255,255,0.45)'} />
          {/* 코 */}
          <path d="M60 72 C58 88 62 98 72 99 C78 99.5 81 95 79 91" fill="none" stroke={B} strokeWidth="13" strokeLinecap="round" />
          <path d="M55 84 h10 M57 91 h9" fill="none" stroke="rgba(255,255,255,0.13)" strokeWidth="1.4" strokeLinecap="round" />
        </>
      )}
      {/* 눈: 헤드라이트 */}
      {mood === 'happy' ? (
        <g fill="none" stroke={eye} strokeWidth="3.4" strokeLinecap="round" filter={glow}>
          <path d="M40 57 q7 -7 14 0" />
          <path d="M66 57 q7 -7 14 0" />
        </g>
      ) : mood === 'wow' ? (
        <g fill={eye} filter={glow}>
          <rect x="42" y="50" width="10" height="11" rx="4.5" />
          <rect x="68" y="50" width="10" height="11" rx="4.5" />
        </g>
      ) : (
        <g fill="none" stroke={eye} strokeWidth="4" strokeLinecap="round" filter={glow}>
          <path d="M40 53.5 L54 56.5" />
          <path d="M80 53.5 L66 56.5" />
        </g>
      )}
      {/* 장식 (은색 라인) */}
      {acc === 'cap' && (
        <g>
          <path d="M33 41 Q60 20 87 41" fill="none" stroke={silver} strokeWidth="3.2" strokeLinecap="round" />
          <path d="M80 35 L95 38" stroke="#e82127" strokeWidth="3.2" strokeLinecap="round" />
        </g>
      )}
      {acc === 'grad' && (
        <g>
          <rect x="47" y="27" width="26" height="10" rx="2" fill="#16191d" stroke="rgba(255,255,255,0.18)" />
          <polygon points="60,14 94,25 60,36 26,25" fill="#24282e" stroke={silver} strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M88 26 v13" stroke={silver} strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="88" cy="40.5" r="2.4" fill="#e82127" />
        </g>
      )}
      {acc === 'star' && (
        <polygon
          transform="translate(60 21)"
          points="0,-12 3.5,-3.9 12,-3.7 5.4,1.9 7.6,10.2 0,5.4 -7.6,10.2 -5.4,1.9 -12,-3.7 -3.5,-3.9"
          fill="#2a2f36"
          stroke={silver}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      )}
      {acc === 'crown' && (
        <g>
          <path d="M41 36 L44 18 L52 27 L60 13 L68 27 L76 18 L79 36 Z" fill="#20242a" stroke={silver} strokeWidth="1.6" strokeLinejoin="round" />
          <circle cx="60" cy="29" r="2.6" fill="#5b8cff" />
        </g>
      )}
    </svg>
  )
}

/** 한국어 발음을 학습자 글자로 (라오·태국·베트남식·몽골 키릴) — 영어 로마자 대신 */
export function Pron({ ko, sm, block, lang }: { ko: string; sm?: boolean; block?: boolean; lang?: Native }) {
  const native = useStore().native
  const n = lang ?? native
  const cls = `rom-pill${sm ? ' sm' : ''} nf-${n}`
  const text = localPron(ko, n)
  return block ? <div className={cls}>{text}</div> : <span className={cls}>{text}</span>
}

/** 버튼 끝 장식: 분홍 테마는 ♥, 블랙 테마는 → */
export function useHeart() {
  return useStore().theme === 'carbon' ? '→' : '♥'
}

/** 프로필 사진 (없거나 못 불러오면 이름 첫 글자) */
export function Avatar({ src, name, size = 36 }: { src?: string | null; name: string; size?: number }) {
  const [broken, setBroken] = useState(false)
  const letter = (name || '?').trim().charAt(0).toUpperCase()
  const hue = [...(name || '?')].reduce((n, ch) => n + ch.charCodeAt(0), 0) % PASTELS.length
  if (src && !broken) {
    return <img className="avatar" src={src} alt="" width={size} height={size} style={{ width: size, height: size }} referrerPolicy="no-referrer" onError={() => setBroken(true)} />
  }
  return (
    <span className={`avatar letter c-${PASTELS[hue]}`} style={{ width: size, height: size, fontSize: size * 0.45 }} aria-hidden="true">
      {letter}
    </span>
  )
}

export function TopBar({ title, sub, right, onBack }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; onBack?: () => void }) {
  const { pop, t } = useApp()
  return (
    <header className="topbar">
      <button className="bubble-btn" onClick={onBack ?? pop} aria-label={t('back')}>
        <Icon name="back" />
      </button>
      <div className="topbar-title">
        <div className="topbar-main">{title}</div>
        {sub && <div className="topbar-sub">{sub}</div>}
      </div>
      <div className="topbar-right">{right}</div>
    </header>
  )
}

export function Segmented<T extends string>({ value, options, onChange, name }: { value: T; options: { id: T; label: ReactNode }[]; onChange: (v: T) => void; name: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={value === o.id} className={value === o.id ? 'seg-btn on' : 'seg-btn'} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Stepper({ value, min, max, onChange, format }: { value: number; min: number; max: number; onChange: (v: number) => void; format: (v: number) => string }) {
  const { t } = useApp()
  return (
    <div className="stepper">
      <button className="step-btn" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={t('slower')}>
        <Icon name="minus" size={18} />
      </button>
      <span className="stepper-val num">{format(value)}</span>
      <button className="step-btn" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={t('faster')}>
        <Icon name="plus" size={18} />
      </button>
    </div>
  )
}

export function Toggle({ on, onChange, label, id }: { on: boolean; onChange: (v: boolean) => void; label: string; id: string }) {
  return (
    <label className="toggle-row" htmlFor={id}>
      <span>{label}</span>
      <input id={id} type="checkbox" className="toggle" checked={on} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

export function ProgressBar({ value, max, tone = 'pink' }: { value: number; max: number; tone?: 'pink' | 'mint' | 'lilac' | 'butter' }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100)
  return (
    <div className={`bar bar-${tone}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className="bar-fill" style={{ width: `${pct}%` }} />
    </div>
  )
}

/** 파스텔 색 순환 (묶음·회차 번호에 사용) */
export const PASTELS = ['pink', 'lilac', 'mint', 'butter', 'peach', 'sky'] as const
export const pastel = (i: number) => PASTELS[i % PASTELS.length]

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 숫자가 올라갈 때 촤르륵 세면서 커지는 표시 */
export function useCountUp(value: number, ms = 700): [number, boolean] {
  const [shown, setShown] = useState(value)
  const [bump, setBump] = useState(false)
  const prev = useRef(value)
  useEffect(() => {
    const from = prev.current
    prev.current = value
    if (value <= from) {
      setShown(value)
      return
    }
    setBump(true)
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms)
      setShown(Math.round(from + (value - from) * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
      else setTimeout(() => setBump(false), 150)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, ms])
  return [shown, bump]
}
