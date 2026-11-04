import { useEffect, useState } from 'react'
import { tabletGreeting } from './tablet-clock'

export function TabletClock(): React.JSX.Element {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const update = (): void => setNow(new Date())
    const timer = setInterval(update, 1000)
    window.addEventListener('focus', update)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', update)
    }
  }, [])
  const greeting = tabletGreeting(now)
  const time = now.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  return (
    <svg
      className="tablet-clock"
      viewBox="0 0 2560 1440"
      aria-label={`平板时间 ${time}${greeting ? `，${greeting}` : ''}`}
      role="img"
    >
      <g transform="matrix(.91 .18 -.64 .64 1336 821)">
        <text className="tablet-clock-time" x="205" y="260" textAnchor="middle">
          {time}
        </text>
        <text
          className="tablet-clock-greeting"
          x="205"
          y="326"
          textAnchor="middle"
          data-visible={!!greeting}
        >
          {greeting}
        </text>
      </g>
    </svg>
  )
}
