import { object, text } from './tool-storage'
export const NOTES_KEY = 'qijian.notes.v1'
export const NOTE_COLORS = ['cream', 'rose', 'sage', 'lavender'] as const
export type Note = {
  id: string
  title: string
  body: string
  color: (typeof NOTE_COLORS)[number]
  updated: string
}
export type Notes = { version: 1; notes: Note[] }
export function parseNotes(raw: string | null): Notes {
  if (raw === null) return { version: 1, notes: [] }
  const root = object(JSON.parse(raw))
  if (root.version !== 1 || !Array.isArray(root.notes) || root.notes.length > 500)
    throw new Error('Invalid notes')
  const ids = new Set<string>()
  const notes = root.notes.map((value): Note => {
    const n = object(value),
      id = text(n.id, 100)
    if (!id || ids.has(id) || !NOTE_COLORS.includes(n.color as Note['color']))
      throw new Error('Invalid note')
    ids.add(id)
    const updated = text(n.updated, 40)
    if (!Number.isFinite(Date.parse(updated))) throw new Error('Invalid date')
    return {
      id,
      title: text(n.title, 120),
      body: text(n.body, 20000),
      color: n.color as Note['color'],
      updated
    }
  })
  return { version: 1, notes }
}
