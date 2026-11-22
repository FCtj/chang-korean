// 일본어판·영어판 (한국인이 일본어·영어를 배우는 판) 단어 데이터 형식
// 한 시험 레벨(JLPT N5…N1 · TOEIC 450…900) = 파일 하나 = 12단원 × (단어 25 + 문장 5)

/**
 * [배울 말, 읽기, 한국어 뜻, 그림]
 * - 일본어: 읽기 = 가나 (히라가나, 가타카나 말은 가타카나 그대로). 한글 발음은 앱이 가나에서 만듦
 * - 영어: 읽기 = 미국식 IPA (빗금 없이). 문장은 ''
 * - 영어 단어 뜻은 품사를 앞에: '[동] 협상하다' · '[명] 회의' · '[형] 이용 가능한' · '[부] 즉시'
 */
export type EdRow = [term: string, reading: string, meaning: string, emoji: string]

export interface EdUnit {
  /** 레벨 안에서 겹치지 않는 영문 키 (단어 id 에 들어감 → 바꾸지 말 것) */
  key: string
  icon: string
  /** 단원 제목 (한국어) */
  title: string
  words: EdRow[]
  phrases: EdRow[]
}

/** 단어 예문: 배울 말로 쓴 짧은 문장 + 읽기(일본어만, 가나) + 한국어 번역(해요체) */
export interface EdExample {
  ex: string
  rom: string
  ko: string
}
export type EdExampleMap = Record<string, EdExample>
