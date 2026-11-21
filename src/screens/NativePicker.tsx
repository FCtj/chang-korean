// 내 언어 고르기: 라오어 · 태국어는 크게 (중심 언어), 베트남어는 베타로 작게
import type { Native } from '../data/words'
import { NATIVE_INFO, makeT } from '../i18n'

export default function NativePicker({ value, onChange }: { value: Native; onChange: (n: Native) => void }) {
  const main = NATIVE_INFO.filter((n) => !n.beta)
  const beta = NATIVE_INFO.filter((n) => n.beta)
  const card = (n: (typeof NATIVE_INFO)[number]) => (
    <button
      key={n.id}
      role="radio"
      aria-checked={value === n.id}
      className={`native-card ${n.beta ? 'beta' : 'main'} ${value === n.id ? 'on' : ''}`}
      onClick={() => onChange(n.id)}
    >
      <span className="native-flag" aria-hidden="true">
        {n.flag}
      </span>
      <span className="native-text">
        <span className={`native-name nf-${n.id}`}>{n.name}</span>
        <span className="native-arrow">→ 한국어</span>
      </span>
      {n.beta && <span className="beta-tag">{makeT(n.id).t('beta')}</span>}
      {value === n.id && (
        <span className="native-check" aria-hidden="true">
          ✓
        </span>
      )}
    </button>
  )
  return (
    <div className="native-picker" role="radiogroup">
      <div className="native-main">{main.map(card)}</div>
      {beta.map(card)}
    </div>
  )
}
