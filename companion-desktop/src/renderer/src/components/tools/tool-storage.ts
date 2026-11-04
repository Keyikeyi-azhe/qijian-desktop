import { registerLiveData } from '../companion/live-data'
import { useEffect, useRef, useState } from 'react'

export function downloadText(name: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// Keep failed drafts in memory; never overwrite an unreadable saved document.
export function useLocalDocument<T>(
  key: string,
  parse: (raw: string | null) => T,
  serialize: (data: T) => string = JSON.stringify
): {
  data: T
  save: (next: T) => boolean
  error: string
  dirty: { current: boolean }
  readOnly: boolean
} {
  const [loaded] = useState(() => {
    try {
      return { data: parse(localStorage.getItem(key)), error: '' }
    } catch {
      return {
        data: parse(null),
        error: '本机数据读取失败，原数据已保留。请备份后检查，不会覆盖原文件。'
      }
    }
  })
  const [data, setData] = useState(loaded.data)
  const [error, setError] = useState(loaded.error)
  const dirty = useRef(false)
  useEffect(
    () => registerLiveData(key, () => ({ data, error: loaded.error })),
    [key, data, loaded.error]
  )
  const save = (next: T): boolean => {
    if (loaded.error) return false
    setData(next)
    dirty.current = true
    try {
      localStorage.setItem(key, serialize(next))
      dirty.current = false
      setError('')
      return true
    } catch {
      setError('保存失败，编辑内容仍在当前窗口。请导出备份或重试保存后再退出。')
      return false
    }
  }
  return { data, save, error, dirty, readOnly: Boolean(loaded.error) }
}

export type CloseGuard = () => boolean | Promise<boolean>
export type DeskTool = 'memo' | 'drawing-tools' | 'vocabulary' | 'tablet'
export function isDeskTool(id: string): id is DeskTool {
  return ['memo', 'drawing-tools', 'vocabulary', 'tablet'].includes(id)
}
export type ToolProps = { setCloseGuard: (guard: CloseGuard) => void }

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid object')
  return value as Record<string, unknown>
}
export function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || value.length > max) throw new Error('Invalid text')
  return value
}
