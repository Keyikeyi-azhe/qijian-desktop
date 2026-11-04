import { validateTool, type LocalTool, type ToolArgs } from '../../../../shared/companion-agent'
import {
  VOCABULARY_KEY,
  loadVocabulary,
  inWordGroup,
  wordGroups,
  WORD_GROUPS,
  EXAM_SOURCE,
  type Vocabulary
} from '../tools/vocabulary-model'
import type { VideoLibraryState } from '../../../../shared/videos'
import { NOTES_KEY, parseNotes, type Notes } from '../tools/notes-model'
import {
  STORAGE_KEY,
  parseTodos,
  dateKey,
  parseDate,
  dayInfo,
  type Todo
} from '../calendar/calendar-model'
import { readDrawingWorkspace, type DrawingWorkspace } from '../tools/drawing-store'
import { games } from '../games/game-catalog'
import { companionContext, companionScene } from './events'
import { liveData } from './live-data'

function documentData<T>(key: string, parse: (value: string | null) => T): T {
  const current = liveData<{ data: T; error: string }>(key)
  if (current) {
    if (current.error) throw new Error('当前资料读取失败，不能用默认示例替代你的真实数据。')
    return current.data
  }
  return parse(localStorage.getItem(key))
}
function page<T>(
  rows: T[],
  args: ToolArgs
): { total: number; offset: number; hasMore: boolean; items: T[] } {
  const offset = args.offset || 0,
    limit = args.limit || 20
  return {
    total: rows.length,
    offset,
    hasMore: offset + limit < rows.length,
    items: rows.slice(offset, offset + limit)
  }
}

export function vocabularyResult(
  data: Vocabulary,
  args: ToolArgs,
  currentId?: string,
  now = new Date()
): unknown {
  const history = new Map<string, Vocabulary['reviews']>()
  for (const review of data.reviews) {
    const list = history.get(review.wordId) || []
    list.push(review)
    history.set(review.wordId, list)
  }
  const rows = data.words.map((word) => {
    const logs = (history.get(word.id) || []).slice().sort((a, b) => a.at.localeCompare(b.at))
    const last = logs.slice(-5),
      hard = last.filter((r) => r.rating <= 2).length
    const reviewed = word.card.reps > 0
    const reasons: string[] = []
    if (reviewed && last.at(-1)?.rating === 1) reasons.push('最近一次选择“忘记了”')
    else if (reviewed && last.at(-1)?.rating === 2) reasons.push('最近一次选择“有点难”')
    if (reviewed && hard >= 2) reasons.push(`最近${last.length}次有${hard}次忘记或困难`)
    if (reviewed && word.card.state === 3) reasons.push('处于重新学习阶段')
    if (reviewed && word.card.difficulty >= 7) reasons.push('复习模型估计难度较高（不等于正确率）')
    return {
      id: word.id,
      term: word.term,
      meaning: word.meaning,
      reviewed,
      reps: word.card.reps,
      lapses: word.card.lapses,
      difficulty: word.card.difficulty,
      stability: word.card.stability,
      due: word.card.due.toISOString(),
      lastReview: word.card.last_review?.toISOString(),
      recentRatings: last.map((r) => ({
        rating: r.rating,
        label: ['', '忘记了', '有点难', '记住了', '很轻松'][r.rating],
        at: r.at
      })),
      weakReasons: reasons,
      priority:
        (last.at(-1)?.rating === 1 ? 10 : last.at(-1)?.rating === 2 ? 6 : 0) +
        hard * 2 +
        (word.card.state === 3 ? 4 : 0) +
        word.card.difficulty
    }
  })
  let selected = rows
  if (args.category && !Object.hasOwn(WORD_GROUPS, args.category)) throw new Error('词汇分类无效。')
  if (!args.view || args.view === 'weak')
    selected = rows.filter((r) => r.weakReasons.length).sort((a, b) => b.priority - a.priority)
  else if (args.view === 'due')
    selected = rows
      .filter((r) => Date.parse(r.due) <= now.getTime())
      .sort((a, b) => a.due.localeCompare(b.due))
  else if (args.view === 'current') selected = rows.filter((r) => r.id === currentId)
  else if (args.view !== 'all') throw new Error('词库视图只能为weak/due/current/all。')
  if (args.query) {
    const q = args.query.toLowerCase()
    selected = selected.filter((r) => `${r.term} ${r.meaning}`.toLowerCase().includes(q))
  }
  return {
    source: '本地词库与真实复习记录',
    criteria:
      '薄弱指最近评分困难/忘记、最近五次至少两次困难、重新学习或FSRS难度≥7；只筛已复习词。到期和复习次数不等于掌握差，新词不能判定掌握程度。',
    totalWords: rows.length,
    reviewedWords: rows.filter((r) => r.reviewed).length,
    newWords: rows.filter((r) => !r.reviewed).length,
    dueCount: rows.filter((r) => Date.parse(r.due) <= now.getTime()).length,
    todayReviews: data.reviews.filter((r) => dateKey(new Date(r.at)) === dateKey(now)).length,
    selectedWordId: currentId || null,
    category: args.category || 'all',
    categories: Object.entries(WORD_GROUPS).map(([id, name]) => ({
      id,
      name,
      count: rows.filter((r) => inWordGroup(r.term, id)).length
    })),
    examSource: EXAM_SOURCE,
    ...page(
      selected
        .filter((r) => !args.category || inWordGroup(r.term, args.category))
        .map((r) => ({ ...r, groups: wordGroups(r.term) })),
      args
    )
  }
}

export async function runLocalTool(name: LocalTool, input: ToolArgs): Promise<unknown> {
  const { args } = validateTool(name, input)
  try {
    if (name === 'read_context')
      return {
        source: '当前界面',
        scene: companionScene(),
        context: companionContext(),
        background: document.querySelector<HTMLElement>('.desk-space')?.dataset.theme,
        automaticScene:
          document.querySelector<HTMLElement>('.desk-space')?.dataset.autoScene === 'true',
        localTime: new Date().toLocaleString(),
        now: new Date().toISOString()
      }
    if (name === 'read_vocabulary')
      return vocabularyResult(
        documentData(VOCABULARY_KEY, loadVocabulary),
        args,
        liveData<{ currentId?: string }>('vocabulary-view')?.currentId
      )
    if (name === 'read_calendar') {
      const todos = documentData<Todo[]>(STORAGE_KEY, parseTodos),
        now = new Date()
      let from = args.date,
        to = args.endDate
      if (from === 'today') from = to = dateKey(now)
      else if (from === 'tomorrow') {
        const next = new Date(now)
        next.setDate(now.getDate() + 1)
        from = to = dateKey(next)
      } else if (from === 'week') {
        const start = new Date(now)
        start.setDate(now.getDate() - ((now.getDay() + 6) % 7))
        const end = new Date(start)
        end.setDate(start.getDate() + 6)
        from = dateKey(start)
        to = dateKey(end)
      } else if (args.view === 'current')
        from = to = liveData<{ selected: string }>('calendar-view')?.selected || dateKey(now)
      if ((from && !parseDate(from)) || (to && !parseDate(to)))
        throw new Error('日期应为YYYY-MM-DD或today/tomorrow/week。')
      if (from && !to) to = from
      if (from && to && from > to) throw new Error('日期范围顺序无效。')
      if (args.view && !['pending', 'done', 'all', 'current'].includes(args.view))
        throw new Error('待办视图无效。')
      const rows = todos
        .filter(
          (t) =>
            (!from || t.date >= from) &&
            (!to || t.date <= to) &&
            (!args.query || t.title.includes(args.query)) &&
            (args.view === 'all' ||
              args.view === 'current' ||
              (args.view === 'done' ? t.done : !t.done))
        )
        .sort((a, b) => a.date.localeCompare(b.date))
      return {
        source: '本地日历待办',
        today: dateKey(now),
        selectedDate: from || null,
        dateInfo: from ? dayInfo(parseDate(from)!) : dayInfo(now),
        totalTodos: todos.length,
        unfinished: todos.filter((t) => !t.done).length,
        ...page(rows, args)
      }
    }
    if (name === 'read_notes') {
      const data = documentData<Notes>(NOTES_KEY, parseNotes)
      const current = liveData<{ selected: string }>('notes-view')?.selected
      if (args.view === 'current' || args.view === 'detail') {
        const note = data.notes.find((n) => n.id === (args.view === 'current' ? current : args.id))
        return note
          ? {
              source: '本地便签正文',
              ...note,
              body: note.body.slice(0, 6000),
              truncated: note.body.length > 6000
            }
          : { source: '本地便签', unavailable: '没有选中的便签或该id不存在，请先用list查询。' }
      }
      if (args.view && args.view !== 'list') throw new Error('便签视图无效。')
      const q = args.query?.toLowerCase()
      const rows = data.notes
        .filter((n) => !q || `${n.title}\n${n.body}`.toLowerCase().includes(q))
        .sort((a, b) => b.updated.localeCompare(a.updated))
      return {
        source: '本地便签搜索/索引',
        ...page(
          rows.map((n) => ({
            id: n.id,
            title: n.title,
            updated: n.updated,
            excerpt: n.body.slice(
              Math.max(0, q ? n.body.toLowerCase().indexOf(q) - 80 : 0),
              Math.max(0, q ? n.body.toLowerCase().indexOf(q) - 80 : 0) + 280
            ),
            length: n.body.length
          })),
          args
        )
      }
    }
    if (name === 'read_drawing') {
      const current = liveData<{
        workspace: DrawingWorkspace | null
        error: string
        selectedIds: string[]
      }>('drawing')
      if (current?.error) throw new Error('当前画稿读取失败，不能假装画稿为空。')
      const workspace = current?.workspace || (await readDrawingWorkspace())
      const boards = workspace.boards.filter((b) => !args.query || b.name.includes(args.query))
      const board = workspace.boards.find((b) => b.id === (args.id || workspace.activeId))
      if (args.view === 'list')
        return {
          source: '本地画稿索引',
          activeId: workspace.activeId,
          ...page(
            boards.map(({ id, name }) => ({ id, name })),
            args
          )
        }
      if (!board) return { unavailable: '画稿不存在。' }
      const scene = board.scene ? JSON.parse(board.scene) : { elements: [] }
      const elements = scene.elements.filter((e: { isDeleted?: boolean }) => !e.isDeleted)
      const counts: Record<string, number> = {}
      for (const e of elements) counts[e.type] = (counts[e.type] || 0) + 1
      return {
        source: '当前画稿元素（不包含图片文件）',
        board: { id: board.id, name: board.name },
        boardCount: workspace.boards.length,
        selectedIds: current?.selectedIds || [],
        counts,
        background: scene.appState?.viewBackgroundColor,
        ...page(
          elements.map((e: Record<string, unknown>) => ({
            id: e.id,
            type: e.type,
            x: e.x,
            y: e.y,
            width: e.width,
            height: e.height,
            strokeColor: e.strokeColor,
            backgroundColor: e.backgroundColor,
            text: typeof e.text === 'string' ? e.text.slice(0, 500) : undefined
          })),
          args
        )
      }
    }
    if (name === 'read_game')
      return {
        source: '游戏运行状态与内置规则',
        current: liveData('game') || null,
        catalogue: games.map(({ id, title, controls, description }) => ({
          id,
          title,
          controls,
          description
        })),
        limits:
          '只有current中实际提供的字段才是实时数据；没有分数/局面字段时不能猜，视觉布局可补截图。没有跨局存档承诺。'
      }
    if (name === 'read_videos') {
      if (args.view && !['list', 'current'].includes(args.view))
        throw new Error('视频视图只能为list/current。')
      const live = liveData<{
        current: { id: string; position: number; duration: number; playing: boolean; error: string }
      }>('videos')
      if (!window.videos) throw new Error('视频仓库接口不可用。')
      const data: VideoLibraryState = await window.videos.list()
      const items = data.items.map((v) => ({
        id: v.id,
        title: v.title,
        categoryId: v.categoryId,
        category: data.categories.find((c) => c.id === v.categoryId)?.name || '未分类',
        size: v.size,
        duration: v.duration,
        position: v.position,
        addedAt: v.addedAt
      }))
      const selected = items.filter(
        (v) =>
          (args.view !== 'current' || v.id === live?.current.id) &&
          (!args.query || v.title.toLowerCase().includes(args.query.toLowerCase())) &&
          (args.category === undefined ||
            v.categoryId === args.category ||
            v.category === args.category)
      )
      return {
        source: '本地视频仓库元数据',
        totalVideos: items.length,
        categories: data.categories,
        current: live?.current || null,
        limits: '只知道元数据和播放状态，没有读取整段视频、字幕或音频；不可凭片名总结情节。',
        ...page(selected, args)
      }
    }
    return { error: '此工具由主进程提供。' }
  } catch (cause) {
    return {
      error: cause instanceof Error ? cause.message : '资料读取失败。',
      source: name,
      unavailable: true
    }
  }
}
