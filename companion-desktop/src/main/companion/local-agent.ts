import { randomUUID } from 'node:crypto'
import type { WebContents } from 'electron'
import { validateTool, type LocalToolReply, type ToolArgs } from '../../shared/companion-agent'

export function createLocalAgent(owner: WebContents): {
  query: (name: string, args: ToolArgs, signal: AbortSignal) => Promise<unknown>
  receive: (value: unknown) => void
  dispose: () => void
} {
  const waiting = new Map<string, (value: unknown) => void>()
  const receive = (value: unknown): void => {
    const reply = value as LocalToolReply
    if (!reply || typeof reply.id !== 'string' || !waiting.has(reply.id)) return
    const serialized = JSON.stringify(reply.result)
    waiting.get(reply.id)!(
      serialized && serialized.length <= 24000
        ? reply.result
        : { error: '本地结果过大，缩小查询范围或分页。' }
    )
  }
  const query = (name: string, args: ToolArgs, signal: AbortSignal): Promise<unknown> => {
    const tool = validateTool(name, args)
    if (signal.aborted || owner.isDestroyed()) return Promise.resolve({ error: '查询已取消。' })
    return new Promise((resolve) => {
      const id = randomUUID()
      const finish = (value: unknown): void => {
        clearTimeout(timer)
        signal.removeEventListener('abort', abort)
        waiting.delete(id)
        resolve(value)
      }
      const abort = (): void => finish({ error: '查询已取消。' })
      const timer = setTimeout(
        () => finish({ error: '本地资料读取超时，请重新打开对应功能后重试。' }),
        4000
      )
      waiting.set(id, finish)
      signal.addEventListener('abort', abort, { once: true })
      owner.send('companion:tool-request', { id, ...tool })
    })
  }
  return {
    query,
    receive,
    dispose: () => {
      for (const finish of waiting.values()) finish({ error: '窗口已关闭。' })
      waiting.clear()
    }
  }
}
