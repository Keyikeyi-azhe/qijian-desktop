import { registerLiveData } from '../companion/live-data'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeftIcon,
  CaretLeftIcon,
  CaretRightIcon,
  PlusIcon,
  TrashIcon,
  MagnifyingGlassIcon
} from '@phosphor-icons/react'
import {
  dateKey,
  dayInfo,
  monthDays,
  parseDate,
  MIN_DATE,
  MAX_DATE,
  WEEKDAYS,
  type Todo
} from './calendar-model'

type Props = {
  today: Date
  todos: Todo[]
  error: string
  onSave: (todos: Todo[]) => boolean
  onClose: () => void
}
export function CalendarDetail({ today, todos, error, onSave, onClose }: Props): React.JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null)
  const [selected, setSelected] = useState(dateKey(today))
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1, 12))
  const [jump, setJump] = useState(dateKey(today))
  const [query, setQuery] = useState('')
  const [title, setTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState('')
  useEffect(() => registerLiveData('calendar-view', () => ({ selected })), [selected])
  useEffect(() => {
    const element = dialog.current!
    element.showModal()
    return () => element.close()
  }, [])
  const days = useMemo(() => monthDays(month).map((date) => ({ date, ...dayInfo(date) })), [month])
  const info = dayInfo(parseDate(selected)!)
  const selectedTodos = todos.filter((todo) => todo.date === selected)
  const select = (key: string): void => {
    const date = parseDate(key)
    if (!date) {
      setNotice('请选择 1901—2099 年之间的有效日期。')
      return
    }
    setSelected(key)
    setJump(key)
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1, 12))
    setAdding(false)
    setTitle('')
    setNotice('')
  }
  const search = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    if (!needle) return []
    const results = new Map<string, string[]>()
    for (
      let d = new Date(month.getFullYear(), 0, 1, 12);
      d.getFullYear() === month.getFullYear();
      d.setDate(d.getDate() + 1)
    ) {
      const key = dateKey(d),
        info = dayInfo(d)
      const names = [...info.festivals, info.term].filter(Boolean)
      if ([key, ...names].some((text) => text.toLocaleLowerCase().includes(needle)))
        results.set(key, names)
    }
    for (const todo of todos) {
      if (todo.title.toLocaleLowerCase().includes(needle) || todo.date.includes(needle)) {
        results.set(todo.date, [
          ...(results.get(todo.date) || []),
          `${todo.done ? '已完成：' : ''}${todo.title}`
        ])
      }
    }
    return [...results].sort(([a], [b]) => a.localeCompare(b))
  }, [query, month, todos])
  const changeMonth = (offset: number): void => {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1, 12)
    if (parseDate(dateKey(next))) setMonth(next)
  }
  const moveFocus = (event: React.KeyboardEvent<HTMLButtonElement>, date: Date): void => {
    const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key]
    if (offset === undefined) return
    event.preventDefault()
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset, 12)
    if (!parseDate(dateKey(next))) return
    select(dateKey(next))
    requestAnimationFrame(() =>
      dialog.current?.querySelector<HTMLButtonElement>(`[data-date="${dateKey(next)}"]`)?.focus()
    )
  }
  return createPortal(
    <dialog
      className="calendar-dialog"
      ref={dialog}
      onClose={onClose}
      aria-labelledby="calendar-title"
    >
      <header className="calendar-header">
        <button className="calendar-back" onClick={() => dialog.current?.close()}>
          <ArrowLeftIcon size={18} />
          回到书桌
        </button>
        <span>栖间 · 日子慢慢过</span>
      </header>
      <div className="calendar-heading">
        <div>
          <p className="calendar-eyebrow">留一点时间，给重要的事</p>
          <h1 id="calendar-title">我的日历</h1>
        </div>
        <p>
          今天 · {dateKey(today)} · 星期{WEEKDAYS[today.getDay()]}
        </p>
      </div>
      <div className="calendar-tools">
        <label className="calendar-search">
          <MagnifyingGlassIcon size={19} />
          <span className="visually-hidden">查询节日、日期或待办</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="查节日、日期或待办"
            maxLength={120}
          />
        </label>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            select(jump)
          }}
        >
          <label htmlFor="calendar-jump">跳转日期</label>
          <input
            id="calendar-jump"
            type="date"
            min={MIN_DATE}
            max={MAX_DATE}
            required
            value={jump}
            onChange={(event) => setJump(event.target.value)}
          />
          <button type="submit">前往</button>
        </form>
      </div>
      {(error || notice) && (
        <p className="calendar-error" role="alert">
          {error || notice}
        </p>
      )}
      <div className="calendar-content">
        <section className="calendar-month" aria-label="月份日历">
          <div className="calendar-month-nav">
            <h2>
              {month.getFullYear()}年 <strong>{month.getMonth() + 1}月</strong>
            </h2>
            <div>
              <button
                aria-label="上个月"
                disabled={dateKey(month) <= MIN_DATE}
                onClick={() => changeMonth(-1)}
              >
                <CaretLeftIcon />
              </button>
              <button
                onClick={() => {
                  select(dateKey(today))
                  setQuery('')
                }}
              >
                今天
              </button>
              <button
                aria-label="下个月"
                disabled={dateKey(month) >= '2099-12-01'}
                onClick={() => changeMonth(1)}
              >
                <CaretRightIcon />
              </button>
            </div>
          </div>
          {query.trim() ? (
            <div className="calendar-results" aria-live="polite">
              <p>
                节日与日期查 {month.getFullYear()} 年，待办查全部日期 · {search.length} 个结果
              </p>
              {search.length === 0 && (
                <p className="calendar-empty">没有找到，试试“中秋”或待办里的关键词。</p>
              )}
              {search.map(([key, labels]) => (
                <button
                  key={key}
                  onClick={() => {
                    select(key)
                    setQuery('')
                  }}
                >
                  <time>{key}</time>
                  <span>{labels.join(' · ') || '查看这一天'}</span>
                  <CaretRightIcon />
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="calendar-weekdays">
                {WEEKDAYS.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="calendar-days">
                {days.map(({ date, lunar, festivals, term }) => {
                  const key = dateKey(date),
                    pending = todos.filter((todo) => todo.date === key && !todo.done)
                  return (
                    <button
                      key={key}
                      data-date={key}
                      disabled={!parseDate(key)}
                      data-outside={date.getMonth() !== month.getMonth()}
                      data-selected={key === selected}
                      data-today={key === dateKey(today)}
                      aria-pressed={key === selected}
                      aria-current={key === dateKey(today) ? 'date' : undefined}
                      aria-label={`${key} ${festivals.join(' ')} ${term} ${pending.length ? `${pending.length}项待办` : ''}`}
                      onClick={() => select(key)}
                      onKeyDown={(event) => moveFocus(event, date)}
                    >
                      <span className="calendar-day-number">{date.getDate()}</span>
                      <span
                        className={
                          festivals.length || term ? 'calendar-day-festival' : 'calendar-day-lunar'
                        }
                        title={[...festivals, term].filter(Boolean).join(' · ')}
                      >
                        {festivals[0] || term || lunar.split('月')[1]}
                      </span>
                      {pending.length > 0 && (
                        <span
                          className="calendar-day-todo"
                          title={pending.map((todo) => todo.title).join('；')}
                        >
                          {pending.length} 项待办
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </section>
        <aside className="calendar-agenda">
          <p className="calendar-eyebrow">这一天</p>
          <h2>
            {Number(selected.slice(5, 7))}月{Number(selected.slice(8))}日
          </h2>
          <p>
            {selected.slice(0, 4)}年 · 星期{WEEKDAYS[parseDate(selected)!.getDay()]} · 农历
            {info.lunar}
          </p>
          <div className="calendar-festivals">
            {[...info.festivals, info.term].filter(Boolean).map((name) => (
              <span key={name}>{name}</span>
            ))}
          </div>
          <div className="calendar-agenda-title">
            <h3>重要待办</h3>
            <span>{selectedTodos.filter((todo) => !todo.done).length} 项未完成</span>
          </div>
          {selectedTodos.length === 0 && (
            <p className="calendar-empty">
              这一天还没有安排。
              <br />
              要留下一件重要的事吗？
            </p>
          )}
          <ul className="calendar-todos">
            {selectedTodos.map((todo) => (
              <li key={todo.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={todo.done}
                    onChange={() =>
                      onSave(
                        todos.map((item) =>
                          item.id === todo.id ? { ...item, done: !item.done } : item
                        )
                      )
                    }
                  />
                  <span className={todo.done ? 'is-done' : ''}>{todo.title}</span>
                </label>
                <button
                  aria-label={`删除待办：${todo.title}`}
                  onClick={() => onSave(todos.filter((item) => item.id !== todo.id))}
                >
                  <TrashIcon size={17} />
                </button>
              </li>
            ))}
          </ul>
          {adding ? (
            <form
              className="calendar-add-form"
              onSubmit={(event) => {
                event.preventDefault()
                if (!title.trim()) {
                  setNotice('请填写待办内容。')
                  return
                }
                if (
                  onSave([
                    ...todos,
                    { id: crypto.randomUUID(), date: selected, title: title.trim(), done: false }
                  ])
                ) {
                  setTitle('')
                  setAdding(false)
                  setNotice('')
                }
              }}
            >
              <label htmlFor="todo-title">想记住什么？</label>
              <input
                id="todo-title"
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                required
                placeholder="例如：交报告、朋友生日"
              />
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false)
                    setTitle('')
                  }}
                >
                  取消
                </button>
                <button className="calendar-primary" type="submit">
                  保存待办
                </button>
              </div>
            </form>
          ) : (
            <button className="calendar-add calendar-primary" onClick={() => setAdding(true)}>
              <PlusIcon size={18} />
              添加重要待办
            </button>
          )}
          <p className="calendar-agenda-footnote">保存在这台电脑，同步显示在书桌日历。</p>
        </aside>
      </div>
      <footer className="calendar-footer">
        支持 1901—2099 年 · 节日与节气仅作日期标注，不代表放假或调休安排。
      </footer>
    </dialog>,
    document.body
  )
}
