import { registerLiveData } from '../companion/live-data'
import { useEffect, useRef, useState } from 'react'
import { DownloadSimpleIcon, ArrowCounterClockwiseIcon, PlusIcon } from '@phosphor-icons/react'
import { type Grade } from 'ts-fsrs'
import {
  VOCABULARY_KEY,
  loadVocabulary,
  serializeVocabulary,
  WORD_GROUPS,
  inWordGroup,
  EXAM_SOURCE,
  type WordGroup,
  reviewWord,
  importWords,
  localDay,
  scheduler,
  type Vocabulary
} from './vocabulary-model'
import { downloadText, useLocalDocument, type ToolProps } from './tool-storage'
import { companionEvent } from '../companion/events'

const ratings: [Grade, string][] = [
  [1, '忘记了'],
  [2, '有点难'],
  [3, '记住了'],
  [4, '很轻松']
]
function intervalLabel(due: Date, now: Date): string {
  const minutes = Math.max(1, Math.round((due.getTime() - now.getTime()) / 60000))
  return minutes < 60
    ? `${minutes} 分钟后`
    : minutes < 1440
      ? `${Math.round(minutes / 60)} 小时后`
      : `${Math.round(minutes / 1440)} 天后`
}
export default function VocabularyPanel({ setCloseGuard }: ToolProps): React.JSX.Element {
  const { data, save, error, dirty, readOnly } = useLocalDocument(
    VOCABULARY_KEY,
    loadVocabulary,
    serializeVocabulary
  )
  const [group, setGroup] = useState<WordGroup>('cet4')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const initialized = useRef(false)
  useEffect(() => {
    if (!initialized.current && !readOnly) {
      initialized.current = true
      save(data)
    }
  }, [data, readOnly, save])
  const [now, setNow] = useState(() => new Date())
  const [revealedId, setRevealedId] = useState('')
  const [tab, setTab] = useState<'review' | 'library'>('review')
  const [term, setTerm] = useState(''),
    [meaning, setMeaning] = useState('')
  const [input, setInput] = useState(''),
    [notice, setNotice] = useState('')
  const [previous, setPrevious] = useState<Vocabulary | null>(null)
  useEffect(() => {
    setCloseGuard(() => !dirty.current)
  }, [dirty, setCloseGuard])
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  const grouped = data.words.filter((w) => inWordGroup(w.term, group))
  const matching = grouped.filter((w) =>
    `${w.term} ${w.meaning}`.toLowerCase().includes(search.trim().toLowerCase())
  )
  const pageIndex = Math.min(page, Math.max(0, Math.ceil(matching.length / 50) - 1))
  const due = grouped
    .filter((w) => w.card.due <= now)
    .sort(
      (a, b) =>
        (a.card.reps === 0 ? 1 : 0) - (b.card.reps === 0 ? 1 : 0) ||
        a.card.due.getTime() - b.card.due.getTime()
    )
  const current = due[0],
    revealed = current?.id === revealedId
  useEffect(
    () =>
      registerLiveData('vocabulary-view', () => ({ currentId: current?.id, tab, revealed, group })),
    [current?.id, tab, revealed, group]
  )
  const todayCount = data.reviews.filter((r) => localDay(new Date(r.at)) === localDay(now)).length
  const nextDue = [...grouped].sort((a, b) => a.card.due.getTime() - b.card.due.getTime())[0]?.card
    .due
  const blocked = readOnly || dirty.current
  const append = (content: string): void => {
    try {
      const next = importWords(data, content)
      if (save(next)) {
        setNotice(`新增 ${next.words.length - data.words.length} 个词，重复词已跳过。`)
        setTerm('')
        setMeaning('')
        setInput('')
        setPrevious(null)
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '导入失败')
    }
  }
  return (
    <div className="vocabulary-panel">
      <div className="vocabulary-top">
        <div>
          <p className="tool-eyebrow">每天一点，慢慢记住</p>
          <h2>我的单词卡</h2>
        </div>
        <div className="vocabulary-stats">
          <span>
            <strong>{due.length}</strong> 当前待学
          </span>
          <span>
            <strong>{todayCount}</strong> 今日复习次数
          </span>
          <span>
            <strong>{data.words.length}</strong> 词库总数
          </span>
        </div>
      </div>
      <div className="word-groups" role="group" aria-label="词汇分类">
        {(Object.entries(WORD_GROUPS) as [WordGroup, string][]).map(([id, label]) => (
          <button
            key={id}
            aria-pressed={group === id}
            onClick={() => {
              setGroup(id)
              setPage(0)
              setRevealedId('')
            }}
          >
            {label} <span>{data.words.filter((w) => inWordGroup(w.term, id)).length}</span>
          </button>
        ))}
      </div>
      <div className="tool-tabs" role="tablist" aria-label="背词页面">
        {(['review', 'library'] as const).map((id, i) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {['学习与复习', '管理词库'][i]}
          </button>
        ))}
        <button
          className="vocabulary-export"
          onClick={() =>
            downloadText(
              '栖间-背词备份.json',
              readOnly
                ? (localStorage.getItem(VOCABULARY_KEY) ?? '')
                : JSON.stringify(data, null, 2)
            )
          }
        >
          <DownloadSimpleIcon />
          导出学习备份
        </button>
      </div>
      {error && (
        <p className="tool-error" role="alert">
          {error} {!readOnly && <button onClick={() => save(data)}>重试保存</button>}
        </p>
      )}
      {notice && (
        <p className="tool-notice" role="status">
          {notice}
        </p>
      )}
      {tab === 'review' ? (
        <div className="review-space">
          {current ? (
            <>
              <div className="word-card">
                <span className="tool-eyebrow">
                  {current.card.reps ? '再次相遇' : '认识一个新词'}
                </span>
                <h3 lang="en">{current.term}</h3>
                {revealed ? (
                  <p className="word-meaning">{current.meaning}</p>
                ) : (
                  <button
                    className="tool-primary"
                    disabled={blocked}
                    onClick={() => setRevealedId(current.id)}
                  >
                    显示释义
                  </button>
                )}
                <p className="word-hint">
                  {revealed
                    ? '按真实记忆程度选择，下一次见面的时间会自动安排。'
                    : '先在心里想一想它的意思。'}
                </p>
              </div>
              {revealed && (
                <div className="review-ratings">
                  {ratings.map(([rating, label]) => (
                    <button
                      key={rating}
                      disabled={blocked}
                      data-rating={rating}
                      onClick={() => {
                        try {
                          const before = data,
                            next = reviewWord(data, current.id, rating, new Date())
                          if (save(next)) {
                            companionEvent({
                              kind: 'review',
                              detail: `完成一次复习，评分${label}`,
                              count: todayCount + 1
                            })
                            setPrevious(before)
                            setRevealedId('')
                            setNow(new Date())
                          }
                        } catch {
                          setNotice('复习时间发生变化，请重新打开单词卡后再试。')
                        }
                      }}
                    >
                      <strong>{label}</strong>
                      <span>
                        {intervalLabel(scheduler.next(current.card, now, rating).card.due, now)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="tool-empty">
              <p className="tool-eyebrow">这一轮完成了</p>
              <h3>让记忆休息一下</h3>
              <p>
                {nextDue
                  ? `下一次复习：${nextDue.toLocaleString('zh-CN')}`
                  : '去词库添加你的第一个词。'}
              </p>
              <button onClick={() => setTab('library')}>看看我的词库</button>
            </div>
          )}
          {previous && (
            <button
              className="review-undo"
              disabled={blocked}
              onClick={() => {
                if (save(previous)) {
                  companionEvent({ kind: 'review', detail: '已撤销上次复习评分' })
                  setPrevious(null)
                  setRevealedId('')
                  setNow(new Date())
                }
              }}
            >
              <ArrowCounterClockwiseIcon />
              撤销上一次评分
            </button>
          )}
          <p className="tool-footnote">
            已内置 {EXAM_SOURCE.total.toLocaleString()}{' '}
            个去重词。六级备考包含四级基础，六级进阶只看新增词；同一词共用学习进度。
          </p>
        </div>
      ) : (
        <div className="word-library">
          <section>
            <h3>加入自己的词</h3>
            <form
              className="word-add"
              onSubmit={(e) => {
                e.preventDefault()
                append(`${term}\t${meaning}`)
              }}
            >
              <label>
                单词
                <input
                  value={term}
                  maxLength={100}
                  required
                  disabled={blocked}
                  onChange={(e) => setTerm(e.target.value)}
                />
              </label>
              <label>
                释义
                <input
                  value={meaning}
                  maxLength={500}
                  required
                  disabled={blocked}
                  onChange={(e) => setMeaning(e.target.value)}
                />
              </label>
              <button className="tool-primary" disabled={blocked}>
                <PlusIcon />
                添加
              </button>
            </form>
            <details>
              <summary>批量导入词条 / 恢复备份</summary>
              <p>从表格复制两列：单词、释义；每行一个词，中间用 Tab 分隔。已有词不会被覆盖。</p>
              <label>
                批量词条
                <textarea
                  aria-label="批量词条"
                  maxLength={600000}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={'apple\t苹果\nforest\t森林'}
                />
              </label>
              <button disabled={blocked} onClick={() => append(input)}>
                导入词条
              </button>
              <label className="vocabulary-restore">
                恢复栖间学习备份
                <input
                  type="file"
                  accept=".json"
                  disabled={blocked}
                  onChange={async (e) => {
                    const chosen = e.currentTarget.files?.[0]
                    e.currentTarget.value = ''
                    if (!chosen) return
                    try {
                      if (chosen.size > 20_000_000) throw new Error('too large')
                      const restored = loadVocabulary(await chosen.text())
                      if (!window.confirm('恢复备份将替换当前词库和学习记录。是否继续？')) return
                      if (save(restored)) {
                        setPrevious(null)
                        setRevealedId('')
                        setNotice('已恢复学习备份。')
                      }
                    } catch {
                      setNotice('备份无法读取，原学习记录未更改。')
                    }
                  }}
                />
              </label>
            </details>
          </section>
          <section className="word-list" aria-label="词库列表">
            <label className="word-search">
              搜索当前分类
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(0)
                }}
                placeholder="单词或中文释义"
              />
            </label>
            <p className="tool-footnote">{matching.length} 个词 · 每页 50 个</p>
            {matching.slice(pageIndex * 50, (pageIndex + 1) * 50).map((w) => (
              <div key={w.id}>
                <strong lang="en">{w.term}</strong>
                <span>{w.meaning}</span>
                <small>{w.card.reps ? `已复习 ${w.card.reps} 次` : '新词'}</small>
              </div>
            ))}
            {!matching.length && <p>这个分类里暂时没有匹配的词。</p>}
            <nav className="word-pagination" aria-label="词库分页">
              <button disabled={pageIndex === 0} onClick={() => setPage(pageIndex - 1)}>
                上一页
              </button>
              <span>
                {pageIndex + 1} / {Math.max(1, Math.ceil(matching.length / 50))}
              </span>
              <button
                disabled={(pageIndex + 1) * 50 >= matching.length}
                onClick={() => setPage(pageIndex + 1)}
              >
                下一页
              </button>
            </nav>
            <p className="tool-footnote">
              词表：KyleBing/english-vocabulary · 版本 {EXAM_SOURCE.version}
              。全量导入所列开源词表，保留原有释义与进度；不代表官方唯一考试范围。
            </p>
          </section>
        </div>
      )}
    </div>
  )
}
