// 판별 로고 마크 (120×120 SVG) — 앱 안 회원가입 화면 · 브라우저 탭 아이콘 · 홈 화면 아이콘(PNG)에 씀
// 글꼴에 기대지 않게 글자도 선으로 그림 (어느 기기에서나 같은 모양)
//   ja: 분홍 코끼리 + 붉은 해 + 벚꽃  ·  en: 남색 바탕 + 분홍 코끼리 + 말풍선 "Hi!"
import type { Edition } from './edition'

const INK = '#5B4366'

/** 코끼리 얼굴 (마스코트와 같은 모양, 웃는 눈) */
const elephant = (y = 0) => `
  <g transform="translate(0 ${y})">
    <ellipse cx="23" cy="58" rx="22" ry="27" fill="#FFB9D0"/>
    <ellipse cx="97" cy="58" rx="22" ry="27" fill="#FFB9D0"/>
    <ellipse cx="25" cy="60" rx="13" ry="17" fill="#FF9DBE" opacity="0.6"/>
    <ellipse cx="95" cy="60" rx="13" ry="17" fill="#FF9DBE" opacity="0.6"/>
    <ellipse cx="60" cy="60" rx="34" ry="32" fill="#FFB9D0"/>
    <path d="M60 74 C58 88 62 98 72 99 C78 99.5 81 95 79 91" fill="none" stroke="#FFB9D0" stroke-width="13" stroke-linecap="round"/>
    <path d="M55 85 q5 2.5 10 0 M57 92 q4.5 2.5 9 0" fill="none" stroke="#F590B3" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M41 57 q6 -7 12 0 M67 57 q6 -7 12 0" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/>
    <ellipse cx="37" cy="68" rx="6.5" ry="4" fill="#FF7FA8" opacity="0.5"/>
    <ellipse cx="83" cy="68" rx="6.5" ry="4" fill="#FF7FA8" opacity="0.5"/>
  </g>`

/** 벚꽃 한 송이 (꽃잎 5장) */
const sakura = (x: number, y: number, r: number, rot = 0, fill = '#FFC4D8', core = '#FF6F9F') => {
  const petals = Array.from({ length: 5 }, (_, i) => `<ellipse cx="0" cy="${-r * 0.62}" rx="${r * 0.42}" ry="${r * 0.62}" transform="rotate(${i * 72})" fill="${fill}"/>`).join('')
  return `<g transform="translate(${x} ${y}) rotate(${rot})">${petals}<circle r="${r * 0.22}" fill="${core}"/></g>`
}

const JA = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <rect width="120" height="120" rx="28" fill="#FFF4F1"/>
  <circle cx="60" cy="58" r="44" fill="#FF5C6C"/>
  <circle cx="60" cy="58" r="44" fill="none" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="2"/>
  ${sakura(16, 18, 8, 10, '#FFD3E1', '#FF8FB3')}
  ${sakura(104, 104, 7, -20, '#FFD3E1', '#FF8FB3')}
  ${sakura(102, 20, 5, 30, '#FFD3E1', '#FF8FB3')}
  <g transform="translate(6 8) scale(0.9)">${elephant()}</g>
  ${sakura(90, 30, 11, 18, '#FFE3EC', '#FF4F8B')}
</svg>`

const EN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3D63E0"/><stop offset="1" stop-color="#2440A8"/></linearGradient></defs>
  <rect width="120" height="120" rx="28" fill="url(#g)"/>
  <circle cx="18" cy="100" r="3" fill="#FFFFFF" opacity="0.35"/>
  <circle cx="104" cy="98" r="2.2" fill="#FFFFFF" opacity="0.35"/>
  <circle cx="12" cy="30" r="2" fill="#FFFFFF" opacity="0.35"/>
  <g transform="translate(4 16) scale(0.86)">${elephant()}</g>
  <g transform="translate(80 22)">
    <path d="M-24 -14 H24 a8 8 0 0 1 8 8 V10 a8 8 0 0 1 -8 8 H-4 L-13 26 V18 H-24 a8 8 0 0 1 -8 -8 V-6 a8 8 0 0 1 8 -8 Z" fill="#FFD84D" stroke="#1F2F7A" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M-17 -6 V10 M-17 2 H-7 M-7 -6 V10 M2 0 V10 M12 -6 V5" fill="none" stroke="#1F2F7A" stroke-width="3.6" stroke-linecap="round"/>
    <circle cx="2" cy="-5.5" r="2.2" fill="#1F2F7A"/>
    <circle cx="12" cy="10" r="2.2" fill="#1F2F7A"/>
  </g>
</svg>`

export const LOGO_SVG: Partial<Record<Edition, string>> = { ja: JA, en: EN }
export const logoUri = (ed: Edition): string | null => (LOGO_SVG[ed] ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(LOGO_SVG[ed]!)}` : null)
