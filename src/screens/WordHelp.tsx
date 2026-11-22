// '?' 설명 창: 단어 · 발음 · 뜻 + 예문(한국어 · 발음 · 내 언어) + 사용 팁
import { IS_KO } from '../edition'
import { useApp } from '../ctx'
import { translation, type Word } from '../data/words'
import { useExample } from '../examples'
import { localPron } from '../pron'
import { useStore } from '../store'
import { speakText, speakWord } from '../audio'
import { Icon, Pron } from '../ui'

/** 예문에서 단어(동사·형용사는 '-다' 를 뗀 줄기)를 굵게 */
function highlight(sentence: string, ko: string) {
  const stem = ko.length > 1 && ko.endsWith('다') ? ko.slice(0, -1) : ko.replace(/[?.!]$/, '')
  const at = stem ? sentence.indexOf(stem) : -1
  if (at < 0) return sentence
  return (
    <>
      {sentence.slice(0, at)}
      <mark>{sentence.slice(at, at + stem.length)}</mark>
      {sentence.slice(at + stem.length)}
    </>
  )
}

export default function WordHelp({ word, onClose }: { word: Word; onClose: () => void }) {
  const s = useStore()
  const { t } = useApp()
  const { entry, mn, ar, ready } = useExample(word.ko, word.id)
  const n = s.native
  // 몽골어·아랍어: 예문 파일 안 → 따로 번역한 파일 순서로
  const exTr = !entry ? '' : n === 'mn' ? entry.mn ?? mn?.mn ?? '' : n === 'ar' ? entry.ar ?? ar?.ar ?? '' : entry[n]
  const tipTr = n === 'mn' ? entry?.tip?.mn ?? mn?.tip : n === 'ar' ? entry?.tip?.ar ?? ar?.tip : entry?.tip?.[n]
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="sheet word-help" role="dialog" aria-label={t('wordHelp')} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" aria-hidden="true" />
        <div className="wh-head">
          <span className="wh-emoji" aria-hidden="true">
            {word.emoji}
          </span>
          <div className="wh-word">
            <span className="wh-ko ko">{word.ko}</span>
            <Pron ko={word.ko} sm />
          </div>
          <button className="round-btn sm" onClick={() => speakWord(word)} aria-label={t('speak')}>
            <Icon name="speaker" size={18} />
          </button>
        </div>
        <div className="wh-row">
          <span className="wh-label">{t('meaningLabel')}</span>
          <span className={`wh-meaning nf-${n}`}>{translation(word)}</span>
        </div>
        {word.kind !== 'phrase' && (
          <div className="wh-ex">
            <span className="wh-label">💬 {t('exampleLabel')}</span>
            {entry ? (
              <>
                <div className="wh-ex-line">
                  <p className="wh-ex-ko ko">{highlight(entry.ex, word.ko)}</p>
                  <button className="round-btn sm" onClick={() => speakText(entry.ex, 'ko')} aria-label={t('speak')}>
                    <Icon name="speaker" size={16} />
                  </button>
                </div>
                {IS_KO ? <span className={`wh-ex-rom nf-${n}`}>{localPron(entry.ex, n)}</span> : entry.rom ? <span className="wh-ex-rom ed-pron">{entry.rom}</span> : null}
                <p className={`wh-ex-tr nf-${n}`}>{exTr}</p>
              </>
            ) : (
              <p className="note">{ready ? t('exampleSoon') : '…'}</p>
            )}
          </div>
        )}
        {tipTr && (
          <div className={`wh-tip nf-${n}`}>
            💡 {tipTr}
          </div>
        )}
        <button className="btn btn-soft btn-block" onClick={onClose}>
          {t('ok')}
        </button>
      </section>
    </div>
  )
}
