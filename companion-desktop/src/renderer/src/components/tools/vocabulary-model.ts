import { createEmptyCard, fsrs, type Card, type Grade } from 'ts-fsrs'
import { object, text } from './tool-storage'
import * as exam from './exam-vocabulary.json'
export const WORD_GROUPS = {
  all: '全部词汇',
  cet4: '四级',
  cet6: '六级备考（含四级基础）',
  advanced: '六级进阶',
  custom: '自定义'
} as const
export type WordGroup = keyof typeof WORD_GROUPS
export const EXAM_SOURCE = {
  version: exam.version,
  source: exam.source,
  stats: exam.stats,
  total: exam.words.length
}
const examIndex = new Map(exam.words.map((word) => [word.term.toLowerCase(), word]))
const examIds = new Map(exam.words.map((word, index) => [`exam-${index}`, word]))
export function serializeVocabulary(data: Vocabulary): string {
  const reviewed = new Set(data.reviews.map((r) => r.wordId))
  // The shipped definitions are immutable; only user entries and learning changes need storage.
  return JSON.stringify({
    ...data,
    words: data.words.filter((w) => {
      const bundled = examIds.get(w.id)
      return (
        !bundled ||
        w.term !== bundled.term ||
        w.meaning !== bundled.meaning ||
        w.card.reps !== 0 ||
        w.card.state !== 0 ||
        w.card.stability !== 0 ||
        w.card.difficulty !== 0 ||
        w.card.lapses !== 0 ||
        w.card.scheduled_days !== 0 ||
        w.card.learning_steps !== 0 ||
        !!w.card.last_review ||
        w.card.due.getTime() > Date.now() ||
        reviewed.has(w.id)
      )
    })
  })
}
export function inWordGroup(term: string, group: string): boolean {
  const entry = examIndex.get(term.toLowerCase())
  if (group === 'all') return true
  if (group === 'custom') return !entry
  if (group === 'cet6') return !!entry
  if (group === 'advanced') return !!entry && !entry.levels.includes('cet4')
  return group === 'cet4' && !!entry?.levels.includes('cet4')
}
export function wordGroups(term: string): string[] {
  return Object.keys(WORD_GROUPS).filter((g) => g !== 'all' && inWordGroup(term, g))
}
// Merge the shipped corpus without replacing users' definitions, IDs or FSRS history.
export function loadVocabulary(raw: string | null): Vocabulary {
  const data: Vocabulary =
    raw === null ? { version: 1, words: [], reviews: [] } : parseVocabulary(raw)
  const terms = new Set(data.words.map((w) => w.term.toLowerCase()))
  const ids = new Set(data.words.map((w) => w.id))
  const now = new Date()
  const added: Word[] = []
  for (const [index, entry] of exam.words.entries()) {
    if (terms.has(entry.term.toLowerCase())) continue
    let id = `exam-${index}`
    while (ids.has(id)) id += '-'
    ids.add(id)
    added.push({ id, term: entry.term, meaning: entry.meaning, card: createEmptyCard(now) })
  }
  if (data.words.length + added.length > 20000)
    throw new Error('词库总数超过20000，请先备份并整理。')
  return { ...data, words: [...data.words, ...added] }
}
export const VOCABULARY_KEY = 'qijian.vocabulary.v1'
export type Word = { id: string; term: string; meaning: string; card: Card }
export type Review = { wordId: string; rating: Grade; at: string; due: string }
export type Vocabulary = { version: 1; words: Word[]; reviews: Review[] }
export const scheduler = fsrs({ enable_fuzz: false })

// Original short glosses, not an imported commercial dictionary.
const sample = [
  ['serene', '宁静的；平和的'],
  ['wander', '漫步；闲逛'],
  ['bloom', '开花；绽放'],
  ['cherish', '珍惜；爱护'],
  ['gentle', '温柔的；轻缓的'],
  ['curious', '好奇的'],
  ['pause', '暂停；停顿'],
  ['cozy', '舒适温暖的'],
  ['habit', '习惯'],
  ['discover', '发现'],
  ['patient', '有耐心的'],
  ['companion', '伙伴；同伴']
]
export function freshVocabulary(now = new Date()): Vocabulary {
  return {
    version: 1,
    words: sample.map(([term, meaning]) => ({
      id: `sample-${term}`,
      term,
      meaning,
      card: createEmptyCard(now)
    })),
    reviews: []
  }
}
function validDate(value: unknown): Date {
  if (typeof value !== 'string' || !value || !Number.isFinite(Date.parse(value)))
    throw new Error('Invalid date')
  return new Date(value)
}
export function parseVocabulary(raw: string | null): Vocabulary {
  if (raw === null) return freshVocabulary()
  const root = object(JSON.parse(raw)),
    ids = new Set<string>(),
    terms = new Set<string>()
  if (
    root.version !== 1 ||
    !Array.isArray(root.words) ||
    root.words.length > 20000 ||
    !Array.isArray(root.reviews) ||
    root.reviews.length > 50000
  )
    throw new Error('Invalid vocabulary')
  const words = root.words.map((value): Word => {
    const w = object(value),
      id = text(w.id, 100),
      term = text(w.term, 100),
      meaning = text(w.meaning, 500),
      c = object(w.card)
    if (!id || ids.has(id) || !term.trim() || !meaning.trim() || terms.has(term.toLowerCase()))
      throw new Error('Duplicate or empty word')
    ids.add(id)
    terms.add(term.toLowerCase())
    for (const key of [
      'stability',
      'difficulty',
      'scheduled_days',
      'learning_steps',
      'reps',
      'lapses',
      'state'
    ]) {
      if (typeof c[key] !== 'number' || !Number.isFinite(c[key]) || c[key] < 0)
        throw new Error('Invalid card')
    }
    if (![0, 1, 2, 3].includes(c.state as number) || (c.difficulty as number) > 10)
      throw new Error('Invalid card')
    for (const key of ['learning_steps', 'reps', 'lapses'])
      if (!Number.isSafeInteger(c[key])) throw new Error('Invalid count')
    const card = {
      ...c,
      due: validDate(c.due),
      last_review: c.last_review === undefined ? undefined : validDate(c.last_review)
    } as unknown as Card
    if (card.reps > 0 && !card.last_review) throw new Error('Missing last review')
    return { id, term, meaning, card }
  })
  const reviews = root.reviews.map((value): Review => {
    const r = object(value),
      wordId = text(r.wordId, 100)
    if (!ids.has(wordId) || ![1, 2, 3, 4].includes(r.rating as number))
      throw new Error('Invalid review')
    return {
      wordId,
      rating: r.rating as Grade,
      at: validDate(r.at).toISOString(),
      due: validDate(r.due).toISOString()
    }
  })
  return { version: 1, words, reviews }
}
export function reviewWord(data: Vocabulary, id: string, rating: Grade, now: Date): Vocabulary {
  const word = data.words.find((w) => w.id === id)
  if (!word || ![1, 2, 3, 4].includes(rating) || word.card.due > now)
    throw new Error('Card not due')
  const next = scheduler.next(word.card, now, rating)
  return {
    ...data,
    words: data.words.map((w) => (w.id === id ? { ...w, card: next.card } : w)),
    reviews: [
      ...data.reviews,
      { wordId: id, rating, at: now.toISOString(), due: next.card.due.toISOString() }
    ].slice(-50000)
  }
}
export function importWords(data: Vocabulary, input: string, now = new Date()): Vocabulary {
  const lines = input
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim())
  if (!input.trim() || lines.length > 1000) throw new Error('每次请输入 1—1000 行词条。')
  const existing = new Set(data.words.map((w) => w.term.toLowerCase()))
  const added: Word[] = []
  for (const [index, line] of lines.entries()) {
    const columns = line.split('\t')
    if (
      columns.length !== 2 ||
      !columns[0].trim() ||
      !columns[1].trim() ||
      columns[0].trim().length > 100 ||
      columns[1].trim().length > 500
    )
      throw new Error(
        `第 ${index + 1} 行需要“单词 + Tab + 释义”，单词不超过 100 字、释义不超过 500 字。`
      )
    const term = columns[0].trim(),
      meaning = columns[1].trim()
    if (existing.has(term.toLowerCase())) continue
    existing.add(term.toLowerCase())
    added.push({ id: crypto.randomUUID(), term, meaning, card: createEmptyCard(now) })
  }
  if (data.words.length + added.length > 20000)
    throw new Error('词库最多 20000 个词，请拆分学习资料。')
  return { ...data, words: [...data.words, ...added] }
}
export function localDay(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}
