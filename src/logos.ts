// 판별 로고 마크 (120×120 SVG) — 앱 안 회원가입 화면 · 브라우저 탭 아이콘 · 홈 화면 아이콘(PNG)에 씀
// 글꼴에 기대지 않게 글자도 선으로 그림 (어느 기기에서나 같은 모양)
//   ja: 시바견 + 붉은 해 + 벚꽃  ·  en: 남색 바탕 + 흰머리수리 + 말풍선 "Hi!"
import type { Edition } from './edition'

const INK = '#5B4366'

const EYES = `<path d="M41 57 q6 -7 12 0 M67 57 q6 -7 12 0" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/>
    <ellipse cx="36" cy="67" rx="6.5" ry="4" fill="#FF7FA8" opacity="0.45"/>
    <ellipse cx="84" cy="67" rx="6.5" ry="4" fill="#FF7FA8" opacity="0.45"/>`

/** 일본어판 마스코트: 시바견 (앱 안 마스코트 ui.tsx ShibaHead 와 같은 모양) */
const shiba = () => `
  <g>
    <path d="M28 48 Q26 22 34 12 Q48 20 56 34 Z" fill="#F4A65D"/>
    <path d="M92 48 Q94 22 86 12 Q72 20 64 34 Z" fill="#F4A65D"/>
    <path d="M33 40 Q32 26 36 20 Q44 25 49 34 Z" fill="#FFD9B8"/>
    <path d="M87 40 Q88 26 84 20 Q76 25 71 34 Z" fill="#FFD9B8"/>
    <ellipse cx="60" cy="62" rx="37" ry="33" fill="#F4A65D"/>
    <path d="M24 66 Q26 94 60 96 Q94 94 96 66 Q88 76 75 73 Q66 71 60 78 Q54 71 45 73 Q32 76 24 66 Z" fill="#FFF4E4"/>
    <ellipse cx="45" cy="45" rx="4.2" ry="2.8" fill="#FFF4E4"/>
    <ellipse cx="75" cy="45" rx="4.2" ry="2.8" fill="#FFF4E4"/>
    <ellipse cx="60" cy="75" rx="5" ry="3.6" fill="${INK}"/>
    <path d="M60 78.5 v3 M60 81.5 q-4 4 -8 1 M60 81.5 q4 4 8 1" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
    ${EYES}
  </g>`

/** 영어판 마스코트: 흰머리수리 (ui.tsx EagleHead 와 같은 모양) */
const eagle = () => `
  <g>
    <path d="M10 114 Q14 84 40 84 L60 92 L80 84 Q106 84 110 114 Z" fill="#8C5A3A"/>
    <path d="M40 34 L46 20 L52 31 L60 16 L68 31 L74 20 L80 34 Z" fill="#FFFFFF" stroke="#E7DCE4" stroke-width="2" stroke-linejoin="round"/>
    <ellipse cx="60" cy="60" rx="35" ry="33" fill="#FFFFFF" stroke="#E7DCE4" stroke-width="2"/>
    <path d="M36 86 L42 94 L48 88 L54 96 L60 89 L66 96 L72 88 L78 94 L84 86" fill="#FFFFFF" stroke="#E7DCE4" stroke-width="2" stroke-linejoin="round"/>
    <path d="M49 69 Q60 62 71 69 Q72 79 62 86 Q61 80 58 78 Q51 76 49 69 Z" fill="#FFC93C" stroke="#E7A51A" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M53 71 q7 -3 14 0" fill="none" stroke="#E7A51A" stroke-width="1.6" stroke-linecap="round"/>
    ${EYES}
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
  <g transform="translate(9 10) scale(0.85)">${shiba()}</g>
  ${sakura(90, 30, 11, 18, '#FFE3EC', '#FF4F8B')}
</svg>`

const EN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3D63E0"/><stop offset="1" stop-color="#2440A8"/></linearGradient></defs>
  <rect width="120" height="120" rx="28" fill="url(#g)"/>
  <circle cx="18" cy="100" r="3" fill="#FFFFFF" opacity="0.35"/>
  <circle cx="104" cy="98" r="2.2" fill="#FFFFFF" opacity="0.35"/>
  <circle cx="12" cy="30" r="2" fill="#FFFFFF" opacity="0.35"/>
  <g transform="translate(6 14) scale(0.86)">${eagle()}</g>
  <g transform="translate(80 22)">
    <path d="M-24 -14 H24 a8 8 0 0 1 8 8 V10 a8 8 0 0 1 -8 8 H-4 L-13 26 V18 H-24 a8 8 0 0 1 -8 -8 V-6 a8 8 0 0 1 8 -8 Z" fill="#FFD84D" stroke="#1F2F7A" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M-17 -6 V10 M-17 2 H-7 M-7 -6 V10 M2 0 V10 M12 -6 V5" fill="none" stroke="#1F2F7A" stroke-width="3.6" stroke-linecap="round"/>
    <circle cx="2" cy="-5.5" r="2.2" fill="#1F2F7A"/>
    <circle cx="12" cy="10" r="2.2" fill="#1F2F7A"/>
  </g>
</svg>`

// ───────── 블랙(남자) 테마: 테슬라 같은 메탈 몸 · 파란 헤드라이트 눈 · 빨간 포인트 ─────────
const CARBON_DEFS = `<defs>
    <linearGradient id="cb" x1="0.2" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="#555d69"/><stop offset="1" stop-color="#1c2026"/></linearGradient>
    <linearGradient id="ce" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3d434d"/><stop offset="1" stop-color="#111317"/></linearGradient>
    <linearGradient id="ch" x1="0" y1="1" x2="0.4" y2="0"><stop offset="0" stop-color="#7d8590"/><stop offset="1" stop-color="#eef1f5"/></linearGradient>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22262c"/><stop offset="1" stop-color="#08090b"/></linearGradient>
    <filter id="cg" x="-60%" y="-200%" width="220%" height="500%"><feGaussianBlur stdDeviation="1.8" result="b"/><feFlood flood-color="#5b8cff" flood-opacity="0.9"/><feComposite in2="b" operator="in" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>`
const CARBON_EYES = `<g fill="none" stroke="#eef4ff" stroke-width="4.2" stroke-linecap="round" filter="url(#cg)"><path d="M41 56.5 Q47 54.8 53 56.5"/><path d="M67 56.5 Q73 54.8 79 56.5"/></g>`
const EDGE = 'rgba(255,255,255,0.14)'
const carbonShiba = () => `
  <g>
    <path d="M28 48 Q26 22 34 12 Q48 20 56 34 Z" fill="url(#ce)" stroke="${EDGE}" stroke-width="1"/>
    <path d="M92 48 Q94 22 86 12 Q72 20 64 34 Z" fill="url(#ce)" stroke="${EDGE}" stroke-width="1"/>
    <path d="M34 39 Q33 26 36 21 M86 39 Q87 26 84 21" fill="none" stroke="#e82127" stroke-width="2" stroke-linecap="round"/>
    <ellipse cx="60" cy="62" rx="37" ry="33" fill="url(#cb)"/>
    <path d="M33 50 Q44 33 66 32" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M24 66 Q26 94 60 96 Q94 94 96 66 Q88 76 75 73 Q66 71 60 78 Q54 71 45 73 Q32 76 24 66 Z" fill="#8d959f" stroke="${EDGE}" stroke-width="1"/>
    <ellipse cx="45" cy="45" rx="4" ry="2.4" fill="#d9dde3" opacity="0.75"/>
    <ellipse cx="75" cy="45" rx="4" ry="2.4" fill="#d9dde3" opacity="0.75"/>
    <ellipse cx="60" cy="75" rx="5" ry="3.4" fill="#111317"/>
    <path d="M60 78.5 v3 M60 81.5 q-4 4 -8 1 M60 81.5 q4 4 8 1" fill="none" stroke="#1c2026" stroke-width="1.8" stroke-linecap="round"/>
    ${CARBON_EYES}
  </g>`
const carbonEagle = () => `
  <g>
    <path d="M10 114 Q14 84 40 84 L60 92 L80 84 Q106 84 110 114 Z" fill="url(#ce)" stroke="${EDGE}" stroke-width="1"/>
    <path d="M40 34 L46 20 L52 31 L60 16 L68 31 L74 20 L80 34 Z" fill="url(#ch)" stroke="${EDGE}" stroke-width="1" stroke-linejoin="round"/>
    <ellipse cx="60" cy="60" rx="35" ry="33" fill="url(#ch)"/>
    <path d="M36 86 L42 94 L48 88 L54 96 L60 89 L66 96 L72 88 L78 94 L84 86" fill="url(#ch)" stroke="${EDGE}" stroke-width="1" stroke-linejoin="round"/>
    <rect x="34" y="47" width="52" height="17" rx="8.5" fill="#111317" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>
    <path d="M49 69 Q60 62 71 69 Q72 79 62 86 Q61 80 58 78 Q51 76 49 69 Z" fill="#c99a3a" stroke="#8a6420" stroke-width="1.6" stroke-linejoin="round"/>
    ${CARBON_EYES}
  </g>`
const silverSakura = (x: number, y: number, r: number, rot = 0) => sakura(x, y, r, rot, 'rgba(217,221,227,0.55)', '#e82127')

const JA_CARBON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  ${CARBON_DEFS}
  <rect width="120" height="120" rx="28" fill="url(#bg)"/>
  <circle cx="60" cy="58" r="44" fill="#e82127" fill-opacity="0.16"/>
  <circle cx="60" cy="58" r="44" fill="none" stroke="#e82127" stroke-width="3"/>
  ${silverSakura(16, 18, 8, 10)}
  ${silverSakura(104, 104, 7, -20)}
  <g transform="translate(9 10) scale(0.85)">${carbonShiba()}</g>
</svg>`

const EN_CARBON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  ${CARBON_DEFS}
  <rect width="120" height="120" rx="28" fill="url(#bg)"/>
  <path d="M8 112 L112 8" stroke="#e82127" stroke-width="1.6" opacity="0.5"/>
  <g transform="translate(6 14) scale(0.86)">${carbonEagle()}</g>
  <g transform="translate(80 22)">
    <path d="M-24 -14 H24 a8 8 0 0 1 8 8 V10 a8 8 0 0 1 -8 8 H-4 L-13 26 V18 H-24 a8 8 0 0 1 -8 -8 V-6 a8 8 0 0 1 8 -8 Z" fill="#16191d" stroke="#d9dde3" stroke-width="2" stroke-linejoin="round"/>
    <path d="M-17 -6 V10 M-17 2 H-7 M-7 -6 V10 M2 0 V10 M12 -6 V5" fill="none" stroke="#eef1f5" stroke-width="3.6" stroke-linecap="round"/>
    <circle cx="2" cy="-5.5" r="2.2" fill="#eef1f5"/>
    <circle cx="12" cy="10" r="2.2" fill="#e82127"/>
  </g>
</svg>`

/** 라오스어판 마스코트: 코끼리 (백만 코끼리의 나라) — 라오스 국기 색(빨강·파랑·흰 동그라미) 위에 */
const elephant = (skin = '#C9D2E3', ear = '#B3BDD2', inner = '#F9C9D9', eyes = EYES) => `
  <g>
    <ellipse cx="27" cy="57" rx="20" ry="24" fill="${ear}"/>
    <ellipse cx="93" cy="57" rx="20" ry="24" fill="${ear}"/>
    <ellipse cx="29" cy="58" rx="12" ry="16" fill="${inner}"/>
    <ellipse cx="91" cy="58" rx="12" ry="16" fill="${inner}"/>
    <ellipse cx="60" cy="56" rx="29" ry="27" fill="${skin}"/>
    <path d="M51 70 Q49 86 55 96 Q60 104 69 99 Q73 96 69 92 Q63 95 62 89 Q60 81 69 70 Z" fill="${skin}"/>
    <path d="M43 38 q5 -4 10 0 M67 38 q5 -4 10 0" fill="none" stroke="#ffffff" stroke-opacity="0.5" stroke-width="2.4" stroke-linecap="round"/>
    ${eyes}
  </g>`
const LO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <defs><clipPath id="lr"><rect width="120" height="120" rx="28"/></clipPath></defs>
  <g clip-path="url(#lr)">
    <rect width="120" height="120" fill="#CE1126"/>
    <rect y="30" width="120" height="60" fill="#002868"/>
  </g>
  <circle cx="60" cy="60" r="41" fill="#FFFFFF"/>
  <g transform="translate(13 12) scale(0.78)">${elephant()}</g>
</svg>`
const LO_CARBON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  ${CARBON_DEFS}
  <rect width="120" height="120" rx="28" fill="url(#bg)"/>
  <rect x="0" y="104" width="120" height="3" fill="#CE1126"/>
  <rect x="0" y="107" width="120" height="3" fill="#3e6ae1"/>
  <rect x="0" y="110" width="120" height="3" fill="#CE1126"/>
  <circle cx="60" cy="56" r="42" fill="none" stroke="#d9dde3" stroke-opacity="0.55" stroke-width="2"/>
  <g transform="translate(10 8) scale(0.84)">${elephant('#9aa3ad', '#6b737d', '#2a2f37', CARBON_EYES)}</g>
</svg>`

export const LOGO_SVG: Partial<Record<Edition, string>> = { ja: JA, en: EN, lo: LO }
export const LOGO_SVG_CARBON: Partial<Record<Edition, string>> = { ja: JA_CARBON, en: EN_CARBON, lo: LO_CARBON }
/** 판 로고 (테마: candy 분홍 / carbon 블랙) */
export const logoUri = (ed: Edition, theme: 'candy' | 'carbon' = 'candy'): string | null => {
  const svg = (theme === 'carbon' ? LOGO_SVG_CARBON : LOGO_SVG)[ed]
  return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null
}
