import type { ReactNode } from 'react'
import { useApp } from './ctx'

type IconName =
  | 'back' | 'play' | 'pause' | 'prev' | 'next' | 'speaker' | 'lock' | 'check' | 'gear'
  | 'trophy' | 'book' | 'gift' | 'minus' | 'plus' | 'eye' | 'cards' | 'ear' | 'flag'

const PATHS: Record<IconName, ReactNode> = {
  back: <path d="M15 5l-7 7 7 7" />,
  play: <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />,
  pause: (
    <>
      <rect x="6.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
      <rect x="13.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  prev: <path d="M17 6l-7 6 7 6M7 6v12" />,
  next: <path d="M7 6l7 6-7 6M17 6v12" />,
  speaker: (
    <>
      <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" fill="currentColor" />
      <path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
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
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 01-8 0z" />
      <path d="M8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8.5 20h7M10 17h4" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5A1.5 1.5 0 015.5 4H11v15H5.5A1.5 1.5 0 004 20.5z" />
      <path d="M20 5.5A1.5 1.5 0 0018.5 4H13v15h5.5a1.5 1.5 0 011.5 1.5z" />
    </>
  ),
  gift: (
    <>
      <rect x="4" y="9" width="16" height="11" rx="1.5" />
      <path d="M3 9h18M12 9v11M12 9c-1.5-4-6-4-5.5-1.5S12 9 12 9zM12 9c1.5-4 6-4 5.5-1.5S12 9 12 9z" />
    </>
  ),
  minus: <path d="M6 12h12" />,
  plus: <path d="M6 12h12M12 6v12" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  cards: (
    <>
      <rect x="4" y="6" width="12" height="15" rx="2" />
      <path d="M8 3h10a2 2 0 012 2v13" />
    </>
  ),
  ear: <path d="M7 10a5 5 0 1110 0c0 3-3 3.5-3 6.5a3 3 0 01-5.5 1.6M10 10a2 2 0 114 0" />,
  flag: <path d="M6 21V4M6 4h11l-2 4 2 4H6" />,
}

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="icon"
    >
      {PATHS[name]}
    </svg>
  )
}

export function TopBar({ title, sub, right, onBack }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; onBack?: () => void }) {
  const { pop, t } = useApp()
  return (
    <header className="topbar">
      <button className="icon-btn" onClick={onBack ?? pop} aria-label={t('back')}>
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

export function Mascot({ badge, size = 56 }: { badge: string; size?: number }) {
  return (
    <span className="mascot" style={{ fontSize: size }} aria-hidden="true">
      <span className="mascot-body">🐘</span>
      <span className="mascot-badge">{badge}</span>
    </span>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  name,
}: {
  value: T
  options: { id: T; label: ReactNode }[]
  onChange: (v: T) => void
  name: string
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={value === o.id}
          className={value === o.id ? 'seg-btn on' : 'seg-btn'}
          onClick={() => onChange(o.id)}
        >
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
      <button className="icon-btn sm" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={t('faster')}>
        <Icon name="minus" size={18} />
      </button>
      <span className="stepper-val num">{format(value)}</span>
      <button className="icon-btn sm" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={t('slower')}>
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

export function ProgressBar({ value, max, tone = 'brand' }: { value: number; max: number; tone?: 'brand' | 'gold' }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100)
  return (
    <div className={`bar bar-${tone}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className="bar-fill" style={{ width: `${pct}%` }} />
    </div>
  )
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
