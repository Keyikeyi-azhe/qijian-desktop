import { Solar } from 'lunar-typescript'

export type Todo = { id: string; date: string; title: string; done: boolean }
export const STORAGE_KEY = 'qijian.calendar.v1'
export const MIN_DATE = '1901-01-01'
export const MAX_DATE = '2099-12-31'
export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < MIN_DATE || value > MAX_DATE) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day, 12)
  return dateKey(date) === value ? date : null
}
export function monthDays(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12)
  return Array.from(
    { length: 42 },
    (_, index) => new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay() + index, 12)
  )
}
export function dayInfo(date: Date): { lunar: string; festivals: string[]; term: string } {
  const solar = Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate())
  const lunar = solar.getLunar()
  return {
    lunar: `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
    festivals: [...new Set([...solar.getFestivals(), ...lunar.getFestivals()])],
    term: lunar.getJieQi()
  }
}
export function parseTodos(raw: string | null): Todo[] {
  if (raw === null) return []
  const data = JSON.parse(raw)
  if (!data || data.version !== 1 || !Array.isArray(data.todos)) throw new Error('invalid data')
  const ids = new Set<string>()
  for (const item of data.todos) {
    if (
      !item ||
      typeof item.id !== 'string' ||
      !item.id ||
      ids.has(item.id) ||
      typeof item.date !== 'string' ||
      !parseDate(item.date) ||
      typeof item.title !== 'string' ||
      !item.title.trim() ||
      item.title.length > 120 ||
      typeof item.done !== 'boolean'
    )
      throw new Error('invalid todo')
    ids.add(item.id)
  }
  return data.todos
}
