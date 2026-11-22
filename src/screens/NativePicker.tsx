// 내 언어 고르기: 네 언어를 같은 크기로. 지금 고른(또는 폰 언어로 짐작한) 언어가 맨 앞
// 순서는 화면을 열 때 정하고, 누르는 동안에는 자리가 바뀌지 않음
import { useState } from 'react'
import type { Native } from '../data/words'
import { NATIVE_INFO } from '../i18n'

export default function NativePicker({ value, onChange }: { value: Native; onChange: (n: Native) => void }) {
  const [order] = useState(() => [...NATIVE_INFO].sort((a, b) => Number(b.id === value) - Number(a.id === value)))
  return (
    <div className="native-picker four" role="radiogroup">
      {order.map((n) => (
        <button key={n.id} role="radio" aria-checked={value === n.id} className={`native-card main ${value === n.id ? 'on' : ''}`} onClick={() => onChange(n.id)}>
          <span className="native-flag" aria-hidden="true">
            {n.flag}
          </span>
          <span className="native-text">
            <span className={`native-name nf-${n.id}`}>{n.name}</span>
            <span className="native-arrow">→ 한국어</span>
          </span>
          {value === n.id && (
            <span className="native-check" aria-hidden="true">
              ✓
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
