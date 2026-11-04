import { useEffect, useRef, useState } from 'react'

export type Theme = 'day' | 'night'
export const themeAt = (date = new Date()): Theme =>
  date.getHours() >= 6 && date.getHours() < 18 ? 'day' : 'night'
const manualKey = 'qijian.scene.manual'
const readManual = (): Theme => {
  try {
    return localStorage.getItem(manualKey) === 'night' ? 'night' : 'day'
  } catch {
    return 'day'
  }
}

export function useSceneTheme(): {
  theme: Theme
  automatic: boolean
  toggle: () => void
  error: string
} {
  const [theme, setTheme] = useState<Theme>(themeAt)
  const [automatic, setAutomatic] = useState(true)
  const [error, setError] = useState('')
  const mode = useRef(true),
    manual = useRef(readManual()),
    overrideUntil = useRef(0)
  const restore = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    let live = true,
      received = false
    const refresh = (): void => {
      if (mode.current && Date.now() >= overrideUntil.current) setTheme(themeAt())
    }
    const apply = (value: boolean): void => {
      mode.current = value
      setAutomatic(value)
      overrideUntil.current = 0
      clearTimeout(restore.current)
      setTheme(value ? themeAt() : manual.current)
    }
    const change = (event: Event): void => {
      const value = (event as CustomEvent<unknown>).detail
      if (typeof value === 'boolean') {
        received = true
        apply(value)
      }
    }
    window.addEventListener('qijian-scene-settings', change)
    void window.companion
      ?.load()
      .then(({ settings }) => {
        if (live && !received) apply(settings.autoScene !== false)
      })
      .catch(() => {
        if (live) setError('昼夜设置读取失败，暂按当前时间显示。')
      })
    const interval = setInterval(refresh, 1000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      live = false
      clearTimeout(restore.current)
      clearInterval(interval)
      window.removeEventListener('qijian-scene-settings', change)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])
  const toggle = (): void => {
    const next = theme === 'day' ? 'night' : 'day'
    manual.current = next
    try {
      localStorage.setItem(manualKey, next)
      setError('')
    } catch {
      setError('背景已切换，但偏好保存失败，重启后可能恢复。')
    }
    setTheme(next)
    clearTimeout(restore.current)
    if (mode.current) {
      overrideUntil.current = Date.now() + 10000
      restore.current = setTimeout(() => {
        if (mode.current) setTheme(themeAt())
      }, 10000)
    }
  }
  return { theme, automatic, toggle, error }
}
