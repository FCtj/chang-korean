// 일본어 가나 → 한글 발음 (일본어판 발음 도움말). 가나를 같이 보여 주므로 대략적인 소리만
// 예: たべる → 타베루 · がっこう → 각코우 · コーヒー → 코-히- · しんぶん → 심분
const BASE: Record<string, string> = {
  あ: '아', い: '이', う: '우', え: '에', お: '오',
  か: '카', き: '키', く: '쿠', け: '케', こ: '코',
  が: '가', ぎ: '기', ぐ: '구', げ: '게', ご: '고',
  さ: '사', し: '시', す: '스', せ: '세', そ: '소',
  ざ: '자', じ: '지', ず: '즈', ぜ: '제', ぞ: '조',
  た: '타', ち: '치', つ: '츠', て: '테', と: '토',
  だ: '다', ぢ: '지', づ: '즈', で: '데', ど: '도',
  な: '나', に: '니', ぬ: '누', ね: '네', の: '노',
  は: '하', ひ: '히', ふ: '후', へ: '헤', ほ: '호',
  ば: '바', び: '비', ぶ: '부', べ: '베', ぼ: '보',
  ぱ: '파', ぴ: '피', ぷ: '푸', ぺ: '페', ぽ: '포',
  ま: '마', み: '미', む: '무', め: '메', も: '모',
  や: '야', ゆ: '유', よ: '요',
  ら: '라', り: '리', る: '루', れ: '레', ろ: '로',
  わ: '와', ゐ: '이', ゑ: '에', を: '오', ゔ: '부',
  ぁ: '아', ぃ: '이', ぅ: '우', ぇ: '에', ぉ: '오',
}
// 작은 ゃ ゅ ょ · 가타카나 외래음 (두 글자)
const PAIR: Record<string, string> = {
  きゃ: '캬', きゅ: '큐', きょ: '쿄', ぎゃ: '갸', ぎゅ: '규', ぎょ: '교',
  しゃ: '샤', しゅ: '슈', しょ: '쇼', じゃ: '자', じゅ: '주', じょ: '조', しぇ: '셰', じぇ: '제',
  ちゃ: '차', ちゅ: '추', ちょ: '초', ちぇ: '체', ぢゃ: '자', ぢゅ: '주', ぢょ: '조',
  にゃ: '냐', にゅ: '뉴', にょ: '뇨', ひゃ: '햐', ひゅ: '휴', ひょ: '효',
  びゃ: '뱌', びゅ: '뷰', びょ: '뵤', ぴゃ: '퍄', ぴゅ: '퓨', ぴょ: '표',
  みゃ: '먀', みゅ: '뮤', みょ: '묘', りゃ: '랴', りゅ: '류', りょ: '료',
  ふぁ: '파', ふぃ: '피', ふぇ: '페', ふぉ: '포', ふゅ: '퓨',
  てぃ: '티', でぃ: '디', とぅ: '투', どぅ: '두', でゅ: '듀', てゅ: '튜',
  うぃ: '위', うぇ: '웨', うぉ: '워', ゔぁ: '바', ゔぃ: '비', ゔぇ: '베', ゔぉ: '보',
  つぁ: '차', つぃ: '치', つぇ: '체', つぉ: '초', いぇ: '예',
}
const SMALL = new Set(['ゃ', 'ゅ', 'ょ', 'ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ'])

/** 가타카나 → 히라가나 (ー 는 그대로) */
const toHira = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))

// 한글 음절에 받침 붙이기 (받침 번호: ㄱ 1 · ㄴ 4 · ㅁ 16 · ㅂ 17 · ㅅ 19 · ㅇ 21)
function addFinal(syl: string, fin: number): string {
  const c = syl.charCodeAt(0) - 0xac00
  if (c < 0 || c > 11171 || c % 28 !== 0) return syl
  return String.fromCharCode(0xac00 + c + fin)
}
const nextConsonant = (h: string) => (h ? Math.floor((h.charCodeAt(0) - 0xac00) / 588) : -1) // 초성 번호

// 앞 음절 모음 (중성 번호): ㅗ 8 · ㅛ 12 → o, ㅜ 13 · ㅠ 17 · ㅡ 18 → u, ㅔ 5 · ㅖ 7 → e (받침 있으면 없음)
function vowelOf(syl: string | undefined): 'o' | 'u' | 'e' | '' {
  if (!syl) return ''
  const c = syl.charCodeAt(syl.length - 1) - 0xac00
  if (c < 0 || c > 11171 || c % 28 !== 0) return ''
  const v = Math.floor((c % 588) / 28)
  return v === 8 || v === 12 ? 'o' : v === 13 || v === 17 || v === 18 ? 'u' : v === 5 || v === 7 ? 'e' : ''
}

export function kanaToHangul(kana: string): string {
  // 인사말의 は 는 '와'
  const s = toHira(kana).replace(/^(こんにち|こんばん)は/, '$1わ')
  const out: string[] = []
  // 앞 글자에 붙을 받침 (っ · ん) — 다음 소리를 보고 정함
  let pending: 'tsu' | 'n' | null = null
  const flush = (next: string) => {
    if (!pending) return
    const i = out.length - 1
    const ci = nextConsonant(next)
    // 초성: ㄱ0 ㄲ1 ㄴ2 ㄷ3 ㄸ4 ㄹ5 ㅁ6 ㅂ7 ㅃ8 ㅅ9 ㅆ10 ㅇ11 ㅈ12 ㅉ13 ㅊ14 ㅋ15 ㅌ16 ㅍ17 ㅎ18
    let fin: number
    if (pending === 'tsu') fin = ci === 15 || ci === 0 ? 1 : ci === 17 || ci === 7 ? 17 : 19
    else fin = ci === 6 || ci === 7 || ci === 17 ? 16 : ci === 15 || ci === 0 ? 21 : 4
    if (i >= 0 && /[가-힣]$/.test(out[i])) out[i] = out[i].slice(0, -1) + addFinal(out[i].slice(-1), fin)
    else out.push(pending === 'n' ? '응' : '')
    pending = null
  }
  for (let k = 0; k < s.length; k++) {
    const ch = s[k]
    const two = s.slice(k, k + 2)
    if (ch === 'っ') {
      pending = 'tsu'
      continue
    }
    if (ch === 'ん') {
      flush('')
      pending = 'n'
      continue
    }
    if (ch === 'ー') {
      flush('')
      out.push('-')
      continue
    }
    // 장음: お·う단 뒤 う (がっこう → 각코-), え단 뒤 い (せんせい → 센세-)
    const prev = vowelOf(out[out.length - 1])
    if (!pending && ((ch === 'う' && (prev === 'o' || prev === 'u')) || (ch === 'い' && prev === 'e'))) {
      out.push('-')
      continue
    }
    let h: string | undefined
    if (PAIR[two]) {
      h = PAIR[two]
      k++
    } else if (BASE[ch] && !(SMALL.has(ch) && out.length && /[가-힣]$/.test(out[out.length - 1]))) h = BASE[ch]
    else if (SMALL.has(ch)) continue // 앞 소리에 섞인 작은 모음
    if (h) {
      flush(h)
      out.push(h)
    } else {
      flush('')
      out.push(ch === '、' ? ', ' : ch === '。' ? '. ' : ch === '？' ? '? ' : ch === '！' ? '! ' : ch === '・' ? ' ' : ch)
    }
  }
  flush('')
  return out.join('').replace(/\s+/g, ' ').trim()
}
