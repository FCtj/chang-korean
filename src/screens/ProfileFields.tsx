// 프로필: 내 사진 · 성별 (성별에 따라 테마가 바뀜: 여자 = 분홍, 남자 = 블랙)
import { useRef, useState } from 'react'
import { useApp } from '../ctx'
import { setGender, update, useStore, type Gender } from '../store'
import { Avatar } from '../ui'

/** 고른 사진을 가운데(얼굴 쪽으로 살짝 위) 정사각형으로 잘라 작게 줄임 */
async function shrinkPhoto(file: File, size = 192): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = url
    })
    const w = img.naturalWidth
    const h = img.naturalHeight
    const side = Math.min(w, h)
    const c = document.createElement('canvas')
    c.width = c.height = size
    const ctx = c.getContext('2d')
    if (!ctx) throw new Error('no canvas')
    ctx.drawImage(img, (w - side) / 2, (h - side) * 0.3, side, side, 0, 0, size, size)
    return c.toDataURL('image/jpeg', 0.82)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function PhotoPicker({ name }: { name: string }) {
  const s = useStore()
  const { t } = useApp()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  return (
    <div className="photo-picker">
      <button type="button" className="photo-circle" onClick={() => input.current?.click()} aria-label={s.photo ? t('changePhoto') : t('addPhoto')}>
        {s.photo ? <Avatar src={s.photo} name={name} size={76} /> : <span className="photo-empty" aria-hidden="true">📷</span>}
        <span className="photo-plus" aria-hidden="true">
          {s.photo ? '✎' : '+'}
        </span>
      </button>
      <div className="photo-side">
        <button type="button" className="btn btn-soft sm" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? '…' : s.photo ? t('changePhoto') : t('addPhoto')}
        </button>
        {s.photo && (
          <button type="button" className="link-btn" onClick={() => update((st) => ({ ...st, photo: '' }))}>
            {t('removePhoto')}
          </button>
        )}
        <span className="note">{t('photoHint')}</span>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          setBusy(true)
          try {
            const photo = await shrinkPhoto(file)
            update((st) => ({ ...st, photo }))
          } catch {
            /* 못 읽는 사진이면 그냥 무시 */
          } finally {
            setBusy(false)
          }
        }}
      />
    </div>
  )
}

export function GenderPicker() {
  const s = useStore()
  const { t } = useApp()
  const opts: { id: Gender; icon: string; label: string }[] = [
    { id: 'f', icon: '👩', label: t('female') },
    { id: 'm', icon: '👨', label: t('male') },
  ]
  return (
    <div className="gender-picker" role="radiogroup" aria-label={t('gender')}>
      {opts.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={s.gender === o.id} className={`gender-btn g-${o.id} ${s.gender === o.id ? 'on' : ''}`} onClick={() => setGender(o.id)}>
          <span className="gender-icon" aria-hidden="true">
            {o.icon}
          </span>
          <span>{o.label}</span>
          <span className="gender-swatch" aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}
