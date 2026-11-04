import { useMemo } from 'react'
import { dateKey, dayInfo, monthDays, WEEKDAYS, type Todo } from './calendar-model'
import './calendar.css'
import day from '../../assets/desk-scene/day.webp'
import night from '../../assets/desk-scene/night.webp'

export function DeskCalendar({
  today,
  todos,
  theme
}: {
  today: Date
  todos: Todo[]
  theme: 'day' | 'night'
}): React.JSX.Element {
  const days = useMemo(() => monthDays(today).map((date) => ({ date, ...dayInfo(date) })), [today])
  const pending = todos.filter(
    (todo) => !todo.done && todo.date.startsWith(dateKey(today).slice(0, 7))
  )
  return (
    <svg className="desk-calendar" viewBox="0 0 2560 1440" aria-hidden="true">
      <defs>
        <clipPath id="calendar-ribbon">
          <path d="M1037,43 L1053,59 L1018,57 L1040,80 L1090,111 L1057,147 L999,192 L944,245 L965,231 L970,262 L980,277 L1024,250 L1068,199 L1083,179 L1086,225 L1116,222 L1115,183 L1144,148 L1166,179 L1190,173 L1212,150 L1222,140 L1206,109 L1180,77 L1182,55 L1168,51 L1140,62 L1121,58 L1100,23 L1074,4 L1064,6 Z" />
        </clipPath>
        <linearGradient id="calendar-paper" x2="1" y2="1">
          <stop offset="0" stopColor="var(--calendar-paper-light)" />
          <stop offset="1" stopColor="var(--calendar-paper-shade)" />
        </linearGradient>
      </defs>
      <g transform="matrix(1 .105 -.13 1 1045 170)" data-calendar-protected="true">
        <rect x="-9" y="-8" width="746" height="452" rx="15" fill="url(#calendar-paper)" />
        <text className="desk-calendar-year" x="190" y="28">
          {today.getFullYear()} /
        </text>
        <text className="desk-calendar-month" x="720" y="33" textAnchor="end">
          {today.getMonth() + 1}月{today.getDate()}日
        </text>
        <g className="desk-calendar-grid">
          {Array.from({ length: 8 }, (_, i) => (
            <path key={`v${i}`} d={`M${i * 104},55 V410`} />
          ))}
          {Array.from({ length: 8 }, (_, i) => (
            <path key={`h${i}`} d={`M0,${i === 0 ? 55 : 86 + (i - 1) * 54} H728`} />
          ))}
        </g>
        {WEEKDAYS.map((day, i) => (
          <text key={day} x={52 + i * 104} y="77" className="desk-calendar-weekday">
            {day}
          </text>
        ))}
        {days.map(({ date, festivals, term }, i) => {
          if (date.getMonth() !== today.getMonth()) return null
          const key = dateKey(date),
            x = 52 + (i % 7) * 104,
            y = 108 + Math.floor(i / 7) * 54
          const items = pending.filter((todo) => todo.date === key)
          const count = items.length
          const festival = (festivals[0] || term).replace('国际', '')
          const preview = items[0]?.title
          return (
            <g key={key} data-calendar-date={key} data-pending={count}>
              {key === dateKey(today) && (
                <ellipse className="desk-calendar-today" cx={x} cy={y - 6} rx="19" ry="17" />
              )}
              <text x={x} y={y} className="desk-calendar-number">
                {date.getDate()}
              </text>
              <text x={x} y={y + 16} className="desk-calendar-festival">
                {festival}
              </text>
              {preview && (
                <text
                  x={x}
                  y={y + (festival ? 29 : 23)}
                  className="desk-calendar-todo"
                  data-todo-preview={key}
                >
                  {Array.from(preview)
                    .slice(0, count > 1 ? 4 : 5)
                    .join('')}
                  {Array.from(preview).length > (count > 1 ? 4 : 5) ? '…' : ''}
                  {count > 1 ? ` +${count - 1}` : ''}
                </text>
              )}
              {count > 0 && <circle cx={x + 29} cy={y - 8} r="5" className="desk-calendar-dot" />}
            </g>
          )
        })}
        <text x="720" y="434" textAnchor="end" className="desk-calendar-note">
          {pending.length
            ? pending
                .slice()
                .sort((a, b) => a.date.localeCompare(b.date))
                .slice(0, 2)
                .map(
                  (todo) =>
                    `${Number(todo.date.slice(8))}日 ${Array.from(todo.title).slice(0, 12).join('')}${Array.from(todo.title).length > 12 ? '…' : ''}`
                )
                .join(' · ') + (pending.length > 2 ? ` · 共${pending.length}项` : '')
            : '把重要的日子，留在这里'}
        </text>
      </g>
      <image
        href={theme === 'day' ? day : night}
        width="2560"
        height="1440"
        clipPath="url(#calendar-ribbon)"
      />
    </svg>
  )
}
