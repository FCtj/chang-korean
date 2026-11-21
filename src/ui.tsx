import type { CSSProperties, ReactNode } from 'react'
import { useApp } from './ctx'

type IconName = 'back' | 'play' | 'pause' | 'prev' | 'next' | 'speaker' | 'lock' | 'check' | 'gear' | 'gift' | 'minus' | 'plus' | 'home' | 'repeat' | 'skip' | 'heart'

const PATHS: Record<IconName, ReactNode> = {
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
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" fill="currentColor" />,
}

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="icon">
      {PATHS[name]}
    </svg>
  )
}

// ───────── 마스코트: 분홍 아기 코끼리 ─────────
export type Accessory = 'bow' | 'cap' | 'grad' | 'star' | 'crown' | 'none'
export const TIER_ACC: Accessory[] = ['bow', 'cap', 'grad', 'star', 'crown']

const TONES = {
  pink: { body: '#FFB9D0', ear: '#FF9DBE', line: '#F590B3' },
  lilac: { body: '#CDBDFF', ear: '#B19BFA', line: '#A895F2' },
  grey: { body: '#E4DCE6', ear: '#D2C6D6', line: '#C9BCCD' },
}

export function Elephant({
  size = 72,
  acc = 'bow',
  mood = 'smile',
  tone = 'pink',
  className,
  style,
}: {
  size?: number
  acc?: Accessory
  mood?: 'smile' | 'happy' | 'wow'
  tone?: keyof typeof TONES
  className?: string
  style?: CSSProperties
}) {
  const c = TONES[tone]
  const ink = '#5B4366'
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true" className={className} style={style}>
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
      <ellipse cx="37" cy="68" rx="6.5" ry="4" fill="#FF7FA8" opacity="0.45" />
      <ellipse cx="83" cy="68" rx="6.5" ry="4" fill="#FF7FA8" opacity="0.45" />
      {/* 장식 */}
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
    </svg>
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
