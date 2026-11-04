import type { LocalToolRequest, LocalToolReply, ToolCall } from './companion-agent'
export type CompanionMemory = {
  id: string
  topic: string
  text: string
  source: 'automatic' | 'manual'
  updatedAt: number
}
export type RecentActivity = {
  kind: 'user' | 'observation'
  text: string
  scene: string
  at: number
}
export type MemoryState = {
  enabled: boolean
  items: CompanionMemory[]
  activity: RecentActivity[]
}
export type MemorySnapshot = MemoryState & { pending: boolean; error: string }
export type MemoryCommand =
  | { action: 'toggle'; enabled: boolean }
  | { action: 'save'; id?: string; text: string }
  | { action: 'delete'; id: string }
  | { action: 'clear' }
  | { action: 'clearActivity' }

export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  status?: 'complete' | 'stopped' | 'error'
}
export type CompanionSettings = {
  model: string
  hasKey: boolean
  nickname: string
  preference: string
  proactive: boolean
  autoScene: boolean
  activity: 'lively' | 'balanced' | 'quiet'
  font: 'rounded' | 'system' | 'serif'
  fontSize: number
  language: 'zh-CN' | 'en'
  vision: boolean
  visionInterval: number
}
export const COMPANION_DEFAULTS: CompanionSettings = {
  model: 'deepseek-flash',
  hasKey: false,
  nickname: '',
  preference: '',
  proactive: true,
  autoScene: true,
  activity: 'lively',
  font: 'rounded',
  fontSize: 13,
  language: 'zh-CN',
  vision: true,
  visionInterval: 5
}
export type CaptureRect = { x: number; y: number; width: number; height: number }
export type CaptureArea = {
  rect: CaptureRect
  masks: CaptureRect[]
  scene: string
  revision?: string
}
export type ChatRequest = {
  id: string
  text: string
  context: string
  retry?: boolean
  mode?: 'chat' | 'observe'
  capture?: CaptureArea
  look?: boolean
}
export const COMPANION_ACTIONS = [
  'idle',
  'happy',
  'cute',
  'meow',
  'bubbles',
  'study',
  'research',
  'paint',
  'calligraphy',
  'game',
  'music',
  'ball',
  'drink',
  'eat',
  'yawn',
  'level-up'
] as const
export type CompanionAction = (typeof COMPANION_ACTIONS)[number]
export function validAction(value: unknown): CompanionAction {
  return COMPANION_ACTIONS.includes(value as CompanionAction) ? (value as CompanionAction) : 'cute'
}
export function dialogueStream(
  onText: (text: string) => void,
  onAction: (action: CompanionAction) => void
): { push: (text: string) => void; flush: () => void } {
  let pending = '',
    decided = false
  return {
    push(text) {
      if (decided) {
        onText(text)
        return
      }
      pending += text
      pending = pending.trimStart()
      const header = pending.match(/^\[action:([a-z-]+)\]\s*/)
      if (header) {
        onAction(validAction(header[1]))
        pending = pending.slice(header[0].length)
        decided = true
      } else if (
        (!'[action:'.startsWith(pending) && !pending.startsWith('[action:')) ||
        pending.length > 80
      )
        decided = true
      if (decided && pending) {
        onText(pending)
        pending = ''
      }
    },
    flush() {
      if (pending) onText(pending.replace(/^\[action:[^\]]*\]?\s*/, ''))
      pending = ''
      decided = true
    }
  }
}
export type ChatUpdate = {
  id: string
  delta?: string
  done?: boolean
  error?: string
  stopped?: boolean
  action?: CompanionAction
  skipped?: boolean
  observation?: string
  memoryChanged?: boolean
}
export type CompanionSnapshot = {
  settings: CompanionSettings
  messages: ChatMessage[]
}
export type CompanionAPI = {
  load: () => Promise<CompanionSnapshot>
  memory: () => Promise<MemorySnapshot>
  updateMemory: (command: MemoryCommand) => Promise<MemorySnapshot>
  configure: (
    settings: Omit<CompanionSettings, 'hasKey'> & { key?: string; removeKey?: boolean }
  ) => Promise<CompanionSettings>
  test: () => Promise<string>
  testVision: () => Promise<string>
  send: (request: ChatRequest) => Promise<void>
  cancel: (id: string) => Promise<void>
  clear: () => Promise<void>
  onToolRequest: (callback: (request: LocalToolRequest) => void) => () => void
  toolResult: (reply: LocalToolReply) => Promise<void>
  onUpdate: (callback: (update: ChatUpdate) => void) => () => void
}

export function boundedText(value: unknown, limit: number): string {
  if (typeof value !== 'string' || value.length > limit)
    throw new Error('输入格式或长度不符合要求。')
  return value
}

// SSE transport chunks may split a UTF-8 character, line, or event.
export async function readChatStream(
  body: ReadableStream<Uint8Array>,
  onText: (text: string) => void,
  onTools?: (calls: ToolCall[]) => void
): Promise<void> {
  const toolCalls = new Map<number, ToolCall>()
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = '',
    complete = false,
    doneMarker = false,
    total = 0,
    received = 0
  const line = (raw: string): void => {
    if (!raw.startsWith('data:')) return
    const data = raw.slice(5).trim()
    if (!data) return
    if (data === '[DONE]') {
      complete = true
      doneMarker = true
      return
    }
    const payload = JSON.parse(data)
    if (payload.error) throw new Error('模型返回错误，请重试。')
    const choice = payload.choices?.[0]
    if (choice?.finish_reason === 'length') throw new Error('回答达到长度限制，已保留收到的内容。')
    if (choice?.finish_reason) complete = true
    for (const part of choice?.delta?.tool_calls || []) {
      if (!onTools || !Number.isInteger(part.index) || part.index < 0 || part.index > 3)
        throw new Error('模型工具调用无效或过多。')
      const call = toolCalls.get(part.index) || {
        id: '',
        type: 'function' as const,
        function: { name: '', arguments: '' }
      }
      if (part.id) call.id += part.id
      if (part.function?.name) call.function.name += part.function.name
      if (part.function?.arguments) call.function.arguments += part.function.arguments
      if (
        call.id.length > 100 ||
        call.function.name.length > 80 ||
        call.function.arguments.length > 4000
      )
        throw new Error('工具参数过长。')
      toolCalls.set(part.index, call)
    }
    const text = choice?.delta?.content
    if (typeof text === 'string') {
      total += text.length
      if (total > 16000) throw new Error('回答过长，已停止接收。')
      onText(text)
    }
  }
  try {
    while (true) {
      const { done, value } = await reader.read()
      received += value?.byteLength ?? 0
      if (received > 2_000_000) throw new Error('响应过大，已停止接收。')
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true })
      if (buffer.length > 128000) throw new Error('响应格式不正确。')
      let end: number
      while ((end = buffer.indexOf('\n')) >= 0) {
        line(buffer.slice(0, end).replace(/\r$/, ''))
        buffer = buffer.slice(end + 1)
      }
      if (doneMarker) break
      if (done) {
        if (buffer.trim()) line(buffer)
        break
      }
    }
    if (!complete || (!total && !toolCalls.size)) throw new Error('回答未完整接收，请重试。')
    if (toolCalls.size) {
      const calls = [...toolCalls.values()]
      if (
        calls.some((c) => !c.id || !c.function.name) ||
        new Set(calls.map((c) => c.id)).size !== calls.length
      )
        throw new Error('工具调用标识无效。')
      onTools?.(calls)
    }
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

// Keep diagnostics about the response shape; never display the model's reasoning trace.
export function visionResult(value: unknown): string {
  const result = value as {
    choices?: {
      finish_reason?: string
      message?: { content?: unknown; reasoning_content?: unknown }
    }[]
  } | null
  const choice = result?.choices?.[0],
    content = choice?.message?.content
  if (choice?.finish_reason === 'length')
    throw new Error('识图输出达到长度上限，结果被截断；请检查是否启用了思考模式或提高输出额度。')
  if (typeof content === 'string' && content.trim()) return content.trim()
  const reasoning = choice?.message?.reasoning_content
  if (typeof reasoning === 'string' && reasoning.length)
    throw new Error('接口只返回了思考内容，没有最终识图答案；请确认使用支持关闭思考的模型。')
  if (!choice || !choice.message || (content != null && typeof content !== 'string'))
    throw new Error('识图接口返回格式异常，未找到有效的文字答案。')
  throw new Error('识图接口返回了空答案，请重试；这不能证明模型不支持图片。')
}
