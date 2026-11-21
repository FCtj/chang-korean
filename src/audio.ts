// 발음 소리 + 효과음
// 1순위: 녹음 파일(public/audio/<id>.mp3, AUDIO_READY 목록)
// 2순위: 안드로이드 앱 → 기기 TTS 엔진 (@capacitor-community/text-to-speech)
//        웹 → 브라우저 음성 합성 (speechSynthesis)
import { Capacitor } from '@capacitor/core'
import { TextToSpeech } from '@capacitor-community/text-to-speech'
import { AUDIO_READY, type Lang, type Word } from './data/words'

const BCP47: Record<Lang, string> = { ko: 'ko-KR', lo: 'lo-LA', th: 'th-TH' }
const native = Capacitor.isNativePlatform()

let webVoices: SpeechSynthesisVoice[] = []
function refreshVoices() {
  try {
    webVoices = window.speechSynthesis?.getVoices() ?? []
  } catch {
    webVoices = []
  }
}
if (!native && typeof window !== 'undefined' && 'speechSynthesis' in window) {
  refreshVoices()
  window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices)
}

function pickWebVoice(lang: Lang): SpeechSynthesisVoice | undefined {
  const prefix = lang
  const list = webVoices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith(prefix))
  // 구글/네트워크 음성이 보통 더 자연스러움
  return list.find((v) => /google|natural|online/i.test(v.name)) ?? list[0]
}

export async function hasVoice(lang: Lang): Promise<boolean> {
  try {
    if (native) return (await TextToSpeech.isLanguageSupported({ lang: BCP47[lang] })).supported
    if (!('speechSynthesis' in window)) return false
    if (webVoices.length === 0) {
      refreshVoices()
      if (webVoices.length === 0) await new Promise((r) => setTimeout(r, 400))
      refreshVoices()
    }
    return !!pickWebVoice(lang)
  } catch {
    return false
  }
}

export async function openVoiceInstall() {
  if (native) await TextToSpeech.openInstall().catch(() => {})
}

let currentAudio: HTMLAudioElement | null = null

export function stopSpeaking() {
  try {
    currentAudio?.pause()
    currentAudio = null
    if (native) TextToSpeech.stop().catch(() => {})
    else window.speechSynthesis?.cancel()
  } catch {
    /* 무시 */
  }
}

/** 텍스트를 읽어줌. 말이 끝나면(또는 최대 4초 후) resolve */
export async function speakText(text: string, lang: Lang, rate = 0.9): Promise<void> {
  stopSpeaking()
  const timeout = new Promise<void>((r) => setTimeout(r, 4000))
  try {
    if (native) {
      await Promise.race([TextToSpeech.speak({ text, lang: BCP47[lang], rate, category: 'playback' }), timeout])
      return
    }
    if (!('speechSynthesis' in window)) return
    const done = new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(text)
      u.lang = BCP47[lang]
      u.rate = rate
      const v = pickWebVoice(lang)
      if (v) u.voice = v
      u.onend = () => resolve()
      u.onerror = () => resolve()
      window.speechSynthesis.speak(u)
    })
    await Promise.race([done, timeout])
  } catch {
    /* 소리가 안 나도 학습은 계속 */
  }
}

/** 단어의 한국어 발음 */
export async function speakWord(w: Word, rate = 0.9): Promise<void> {
  if (AUDIO_READY.has(w.id)) {
    stopSpeaking()
    try {
      const a = new Audio(`audio/${w.id}.mp3`)
      currentAudio = a
      await new Promise<void>((resolve) => {
        a.onended = () => resolve()
        a.onerror = () => resolve()
        a.play().catch(() => resolve())
        setTimeout(resolve, 4000)
      })
      return
    } catch {
      /* TTS로 대체 */
    }
  }
  return speakText(w.ko, 'ko', rate)
}

// ───────── 효과음 (Web Audio, 파일 없음) ─────────
let ctx: AudioContext | null = null
function ac(): AudioContext | null {
  try {
    ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.12) {
  const c = ac()
  if (!c) return
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.value = freq
  g.gain.setValueAtTime(0, c.currentTime + start)
  g.gain.linearRampToValueAtTime(gain, c.currentTime + start + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur)
  o.connect(g).connect(c.destination)
  o.start(c.currentTime + start)
  o.stop(c.currentTime + start + dur + 0.05)
}

export const sfx = {
  correct() {
    tone(784, 0, 0.12, 'triangle')
    tone(1175, 0.09, 0.18, 'triangle')
  },
  wrong() {
    tone(220, 0, 0.22, 'sawtooth', 0.06)
  },
  fanfare() {
    ;[523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.25, 'triangle'))
  },
  tick() {
    tone(1400, 0, 0.03, 'square', 0.03)
  },
  pop() {
    tone(660, 0, 0.06, 'sine', 0.1)
    tone(990, 0.04, 0.08, 'sine', 0.08)
  },
  combo(n: number) {
    const base = 600 + Math.min(n, 8) * 70
    tone(base, 0, 0.08, 'triangle')
    tone(base * 1.5, 0.07, 0.12, 'triangle')
  },
  levelUp() {
    ;[523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.09, 0.3, 'triangle', 0.1))
  },
}
