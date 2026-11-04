import { registerLiveData } from '../companion/live-data'
import { useEffect, useRef, useState } from 'react'
import day from '../../assets/desk-scene/day.webp'
import night from '../../assets/desk-scene/night.webp'
import hotspots from '../../assets/desk-scene/hotspots.json'
import { VPetCompanion } from '../pet/VPetCompanion'
import { TabletClock } from './TabletClock'
import { DeskCalendar } from '../calendar/DeskCalendar'
import { CalendarDetail } from '../calendar/CalendarDetail'
import { DeskTools } from '../tools/DeskTools'
import { GameRoom } from '../games/GameRoom'
import { isDeskTool, type DeskTool } from '../tools/tool-storage'
import { dateKey, parseTodos, STORAGE_KEY, type Todo } from '../calendar/calendar-model'
import { companionEvent } from '../companion/events'
import { useSceneTheme } from './useSceneTheme'
import { SceneSwitch } from './SceneSwitch'

export function DeskScene(): React.JSX.Element {
  const [today, setToday] = useState(() => new Date())
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [gamesOpen, setGamesOpen] = useState(false)
  const [activeTool, setActiveTool] = useState<DeskTool | null>(null)
  const [stored] = useState(() => {
    try {
      return { todos: parseTodos(localStorage.getItem(STORAGE_KEY)), error: '' }
    } catch {
      return { todos: [], error: '未能读取本机待办，原数据已保留。请重启应用后重试。' }
    }
  })
  const [todos, setTodos] = useState<Todo[]>(stored.todos)
  useEffect(
    () => registerLiveData(STORAGE_KEY, () => ({ data: todos, error: stored.error })),
    [todos, stored.error]
  )
  const [saveError, setSaveError] = useState(stored.error)
  const saveTodos = (next: Todo[]): boolean => {
    if (stored.error) return false
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, todos: next }))
      setTodos(next)
      setSaveError('')
      const completed = next.some(
        (todo) => todo.done && todos.some((old) => old.id === todo.id && !old.done)
      )
      companionEvent({ kind: 'todo', detail: completed ? '完成待办' : '更新待办列表' })
      return true
    } catch {
      setSaveError('保存失败，未更改原有待办。请检查磁盘空间后重试。')
      return false
    }
  }
  const { theme, automatic, toggle, error: sceneError } = useSceneTheme()
  const [hovered, setHovered] = useState<string | null>(null)
  const [focused, setFocused] = useState<string | null>(null)
  const [pressed, setPressed] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const active = hovered ?? focused ?? pressed
  useEffect(() => {
    companionEvent({
      kind: 'scene',
      detail: calendarOpen
        ? '日历 calendar'
        : gamesOpen
          ? '游戏 game'
          : activeTool === 'memo'
            ? '便签 memo'
            : activeTool === 'drawing-tools'
              ? '画板 drawing'
              : activeTool === 'vocabulary'
                ? '背词 vocabulary'
                : activeTool === 'tablet'
                  ? '视频仓库 video'
                  : '书桌'
    })
  }, [calendarOpen, gamesOpen, activeTool])
  const objects = hotspots[theme]

  useEffect(() => {
    const refresh = (): void => {
      setToday((previous) => (dateKey(previous) === dateKey(new Date()) ? previous : new Date()))
    }
    const interval = setInterval(refresh, 1000)
    window.addEventListener('focus', refresh)
    const reset = (): void => {
      setHovered(null)
      setFocused(null)
      setPressed(null)
      clearTimeout(timer.current)
    }
    window.addEventListener('blur', reset)
    return () => {
      clearInterval(interval)
      clearTimeout(timer.current)
      window.removeEventListener('blur', reset)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  const acknowledge = (id: string): void => {
    if (id === 'controller') {
      setHovered(null)
      setFocused(null)
      setPressed(null)
      setGamesOpen(true)
      return
    }
    if (isDeskTool(id)) {
      setHovered(null)
      setFocused(null)
      setPressed(null)
      setActiveTool(id)
      return
    }
    if (id === 'calendar') {
      setHovered(null)
      setFocused(null)
      setPressed(null)
      setCalendarOpen(true)
      return
    }
    clearTimeout(timer.current)
    setPressed(id)
    timer.current = setTimeout(() => setPressed(null), 240)
  }

  return (
    <main
      className="desk-space"
      data-theme={theme}
      data-auto-scene={automatic}
      aria-label="我的书桌"
    >
      <div className="desk-ambience" aria-hidden="true">
        <img src={day} alt="" className={theme === 'day' ? 'is-visible' : ''} />
        <img src={night} alt="" className={theme === 'night' ? 'is-visible' : ''} />
      </div>
      <div className="desk-stage" data-testid="desk-stage">
        <div className="desk-wallpapers" aria-hidden="true">
          <img src={day} alt="" draggable={false} className={theme === 'day' ? 'is-visible' : ''} />
          <img
            src={night}
            alt=""
            draggable={false}
            className={theme === 'night' ? 'is-visible' : ''}
          />
        </div>
        <DeskCalendar today={today} todos={todos} theme={theme} />
        <TabletClock />
        <svg
          className="desk-hotspots"
          viewBox="0 0 2560 1440"
          aria-label="书桌物件，悬停或使用 Tab 键查看名称"
          onPointerLeave={() => setHovered(null)}
        >
          {objects.map((object) => (
            <g
              key={object.id}
              className="desk-object"
              data-object={object.id}
              data-active={active === object.id}
              data-pressed={pressed === object.id}
            >
              <path
                className="desk-hit"
                d={object.path}
                fillRule="evenodd"
                role="button"
                tabIndex={0}
                aria-label={object.label}
                aria-describedby="desk-interaction-help"
                onPointerEnter={(event) => {
                  if (event.pointerType !== 'touch') {
                    setFocused(null)
                    setHovered(object.id)
                  }
                }}
                onPointerLeave={() => setHovered(null)}
                onFocus={(event) => {
                  if (event.currentTarget.matches(':focus-visible')) {
                    setHovered(null)
                    setFocused(object.id)
                  }
                }}
                onBlur={() => setFocused(null)}
                onClick={() => acknowledge(object.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    acknowledge(object.id)
                  } else if (event.key === 'Escape') {
                    event.currentTarget.blur()
                    setHovered(null)
                    setPressed(null)
                  }
                }}
              />
              <path
                className="desk-highlight"
                d={object.path}
                fillRule="evenodd"
                vectorEffect="non-scaling-stroke"
                aria-hidden="true"
              />
            </g>
          ))}
        </svg>
        <div className="desk-labels" aria-hidden="true">
          {objects.map((object) => (
            <span
              key={object.id}
              className="desk-label"
              data-label={object.id}
              data-visible={active === object.id}
              style={{ left: `${object.labelAt[0] / 25.6}%`, top: `${object.labelAt[1] / 14.4}%` }}
            >
              {object.label}
            </span>
          ))}
        </div>
        <SceneSwitch theme={theme} automatic={automatic} onClick={toggle} />
        {sceneError && (
          <p className="scene-error" role="status">
            {sceneError}
          </p>
        )}
        <VPetCompanion />
      </div>
      {calendarOpen && (
        <CalendarDetail
          today={today}
          todos={todos}
          error={saveError}
          onSave={saveTodos}
          onClose={() => setCalendarOpen(false)}
        />
      )}
      {gamesOpen && <GameRoom theme={theme} onClose={() => setGamesOpen(false)} />}
      {activeTool && (
        <DeskTools tool={activeTool} theme={theme} onClose={() => setActiveTool(null)} />
      )}
      <p id="desk-interaction-help" className="visually-hidden">
        点击手柄选择游戏。 悬停或 Tab
        键聚焦显示物件名称，点击日历查看日期和待办，点击白纸写便签，笔筒打开画板，单词卡开始背词，平板打开视频仓库。
      </p>
    </main>
  )
}
