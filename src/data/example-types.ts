// 단어 예문 형식 ('?' 를 누르면 나오는 설명 창)
// 키 = 단어의 한국어 그대로. 같은 단어는 어느 단원에서든 같은 예문을 씀
// ⚠️ 라오어·태국어·베트남어는 초안 — 원어민 검수 필요
export interface ExampleEntry {
  /** 그 단어를 넣은 짧은 한국어 예문 (해요체) */
  ex: string
  /** 예문 로마자 발음 */
  rom: string
  lo: string
  th: string
  vi: string
  /** (선택) 몽골어 — 없으면 exmn-*.ts 에서 찾음 */
  mn?: string
  /** (선택) 헷갈리기 쉬운 단어의 짧은 사용 팁 — 학습자 언어로 */
  tip?: { lo: string; th: string; vi: string; mn?: string }
}
export type ExampleMap = Record<string, ExampleEntry>
