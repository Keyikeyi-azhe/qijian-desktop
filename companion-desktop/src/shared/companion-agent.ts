export const LOCAL_TOOLS = [
  'read_context',
  'read_vocabulary',
  'read_calendar',
  'read_notes',
  'read_drawing',
  'read_game',
  'read_videos',
  'read_memory',
  'search_help',
  'read_screen'
] as const
export type LocalTool = (typeof LOCAL_TOOLS)[number]
export type ToolArgs = {
  view?: string
  query?: string
  category?: string
  id?: string
  date?: string
  endDate?: string
  offset?: number
  limit?: number
}
export type ToolCall = {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}
export type LocalToolRequest = { id: string; name: LocalTool; args: ToolArgs }
export type LocalToolReply = { id: string; result: unknown }
export type SourceResult = { tool: string; result: unknown }

const descriptions: Record<LocalTool, string> = {
  read_context: '当前功能、时间、已选内容和近期操作，不含屏幕图片。',
  read_vocabulary:
    '读取本地词库及真实复习记录。view: weak薄弱词（默认）、due到期、all全部、current当前卡。category: all/cet4四级/cet6六级备考含四级/advanced六级进阶/custom自定义。query筛选词或释义，offset/limit分页。内置词表不意味着用户已学过，新词不是薄弱词。',
  read_calendar:
    '读取本地日历待办。view: pending未完成（默认）、all全部、done已完成、current选中日期。date/endDate为YYYY-MM-DD范围，可用today/tomorrow/week；query筛选标题，offset/limit分页。',
  read_notes:
    '读取便签正文。view: list索引/搜索（默认）、current正在编辑、detail指定id正文；query按标题和正文搜索，offset/limit分页，正文最多6000字并标明截断。',
  read_drawing:
    '读取画稿列表、当前或指定id画稿的形状、颜色、文字、位置、选中元素。view: list只列画稿；其余含当前画稿内容。图片文件本身不以文字读取，视觉内容可补截图。',
  read_game:
    '当前游戏、真实运行状态、暂停/胜负、可提供的分数与游戏规则。没有遥测的字段明确未知，不能臆造。',
  read_memory: '读取已保存长期记忆及近期共同活动；不是新的实时画面。',
  read_videos:
    '查询本地视频名称、分类、大小、时长和播放进度，以及当前播放状态。view: list（默认）/current；query按名称，category按分类名或id（空字符串为未分类），offset/limit分页。只读元数据，不分析整段视频、声音或字幕，不能凭标题编造内容。',
  search_help: '读取经本项目源码整理的功能说明、操作步骤与能力边界；query写要查的问题。',
  read_screen:
    '仅补充当前栖间窗口视觉细节；词库复习成绩、待办、便签必须先读结构化工具。没有截图权限或窗口不可见时会失败。'
}
export const TOOL_DEFINITIONS = LOCAL_TOOLS.map((name) => ({
  type: 'function' as const,
  function: {
    name,
    description: descriptions[name],
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        view: { type: 'string' },
        query: { type: 'string', maxLength: 200 },
        category: { type: 'string', maxLength: 100 },
        id: { type: 'string', maxLength: 100 },
        date: { type: 'string' },
        endDate: { type: 'string' },
        offset: { type: 'integer', minimum: 0, maximum: 20000 },
        limit: { type: 'integer', minimum: 1, maximum: 30 }
      }
    }
  }
}))
export function validateTool(name: string, value: unknown): { name: LocalTool; args: ToolArgs } {
  if (!LOCAL_TOOLS.includes(name as LocalTool)) throw new Error('只允许查询栖间的已登记本地工具。')
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('工具参数应为对象。')
  const args = value as Record<string, unknown>
  for (const [key, val] of Object.entries(args)) {
    if (!['view', 'query', 'category', 'id', 'date', 'endDate', 'offset', 'limit'].includes(key))
      throw new Error('未知工具参数。')
    if (key === 'offset' || key === 'limit') {
      if (
        !Number.isInteger(val) ||
        Number(val) < (key === 'limit' ? 1 : 0) ||
        Number(val) > (key === 'limit' ? 30 : 20000)
      )
        throw new Error('分页范围无效。')
    } else if (typeof val !== 'string' || val.length > (key === 'query' ? 200 : 100))
      throw new Error('查询文字过长或格式不正确。')
  }
  return { name: name as LocalTool, args: args as ToolArgs }
}

export function routeQuestion(
  text: string,
  scene: string,
  observe = false,
  look = false
): { sources: { name: LocalTool; args: ToolArgs }[]; visual: boolean } {
  const sources: { name: LocalTool; args: ToolArgs }[] = []
  const add = (name: LocalTool, args: ToolArgs = {}): void => {
    if (!sources.some((s) => s.name === name)) sources.push({ name, args })
  }
  const help =
    /怎么(?:打开|使用|导出|导入|设置|删除|添加)|如何(?:使用|打开|导出)|在哪(?:里)?(?:打开|设置)|快捷键|操作方法/.test(
      text
    )
  const smallTalk =
    /^(你好|嗨|谢谢|晚安|早安|陪我聊聊|讲个笑话|你是谁|你叫什么)[！!。?？\s]*$/.test(text)
  const combined = observe ? scene : text
  if (/单词|词库|背词|复习|掌握|薄弱|四级|六级|vocab|word|flashcard/i.test(combined))
    add('read_vocabulary', {
      ...(/四级/.test(text)
        ? { category: 'cet4' }
        : /六级进阶/.test(text)
          ? { category: 'advanced' }
          : /六级/.test(text)
            ? { category: 'cet6' }
            : {}),
      view: /到期|该复习|待复习/.test(text)
        ? 'due'
        : /当前|这个词/.test(text)
          ? 'current'
          : /全部|所有单词|词库/.test(text) && !/薄弱|不牢|不熟|忘|难/.test(text)
            ? 'all'
            : 'weak'
    })
  if (/待办|日历|日程|安排|calendar|todo|schedule/i.test(combined))
    add('read_calendar', {
      view: /完成了|已完成/.test(text) ? 'done' : 'pending',
      ...(/明天/.test(text)
        ? { date: 'tomorrow' }
        : /今天/.test(text)
          ? { date: 'today' }
          : /本周|这周/.test(text)
            ? { date: 'week' }
            : {})
    })
  if (/便签|笔记|memo|note/i.test(combined))
    add('read_notes', { view: observe || /这(?:张|篇)|当前/.test(text) ? 'current' : 'list' })
  if (/画板|画稿|画布|drawing|画得|我画|构图|线条|涂鸦/i.test(combined)) add('read_drawing')
  if (/游戏|水果|六角|回旋镖|沙盘|game|分数|得分|战况/i.test(combined)) add('read_game')
  if (/视频|影片|片库|video/i.test(combined))
    add('read_videos', { view: /当前|正在|这个/.test(text) ? 'current' : 'list' })
  if (/记得|记忆|我的偏好|remember/i.test(text)) add('read_memory')
  if (/昼夜|白天|夜晚|背景|场景开关/.test(text)) add('read_context')
  if (help) {
    sources.length = 0
    add('search_help', { query: text.slice(0, 200) })
  }
  if (!sources.length && !smallTalk && !help) {
    if (/vocabulary/.test(scene))
      add('read_vocabulary', { view: /薄弱|不牢|不熟|忘|难/.test(text) ? 'weak' : 'current' })
    else if (/calendar/.test(scene)) add('read_calendar', { view: 'current' })
    else if (/memo/.test(scene)) add('read_notes', { view: 'current' })
    else if (/drawing/.test(scene)) add('read_drawing')
    else if (/game/.test(scene)) add('read_game')
    else if (/video/.test(scene)) add('read_videos', { view: 'current' })
  }
  return {
    sources,
    visual:
      look ||
      (observe && !sources.length) ||
      (!help &&
        !smallTalk &&
        ((/drawing|画板/.test(scene) && sources.some((s) => s.name === 'read_drawing')) ||
          (sources.some((s) => s.name === 'read_game') &&
            /game|游戏/.test(scene) &&
            !/规则|操作|怎么玩|多少分|得分|分数/.test(text))))
  }
}
