import { BrowserWindow, dialog, ipcMain, protocol, type WebContents } from 'electron'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { extname } from 'node:path'
import { VIDEO_EXTENSIONS, type VideoPatch } from '../shared/videos'
import { VideoLibrary } from './video-library'

export function videoRange(
  header: string | null,
  size: number
): { start: number; end: number } | null {
  if (!header) return { start: 0, end: size - 1 }
  const match = /^bytes=(\d*)-(\d*)$/.exec(header)
  if (!match || (!match[1] && !match[2])) return null
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]))
  const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1
  return Number.isSafeInteger(start) &&
    Number.isSafeInteger(end) &&
    start >= 0 &&
    start < size &&
    end >= start
    ? { start, end }
    : null
}
export function registerVideoProtocol(library: VideoLibrary): void {
  protocol.handle('qijian-video', async (request) => {
    try {
      const url = new URL(request.url)
      if (
        !['GET', 'HEAD'].includes(request.method) ||
        url.hostname !== 'library' ||
        !/^\/[a-z0-9-]{1,80}$/.test(url.pathname)
      )
        return new Response(null, { status: 403 })
      const file = await library.file(url.pathname.slice(1))
      const { size } = await stat(file.path)
      const header = request.headers.get('range'),
        range = videoRange(header, size)
      if (!range)
        return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
      const mime: Record<string, string> = {
        '.mp4': 'video/mp4',
        '.m4v': 'video/mp4',
        '.mov': 'video/quicktime',
        '.webm': 'video/webm',
        '.ogv': 'video/ogg',
        '.ogg': 'video/ogg',
        '.mkv': 'video/x-matroska'
      }
      const headers: Record<string, string> = {
        'Content-Type': mime[extname(file.path)] || 'application/octet-stream',
        'Content-Length': String(range.end - range.start + 1),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      }
      if (header) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${size}`
      if (request.method === 'HEAD')
        return new Response(null, { status: header ? 206 : 200, headers })
      const stream = createReadStream(file.path, range)
      const cancel = (): void => {
        stream.destroy()
      }
      request.signal.addEventListener('abort', cancel, { once: true })
      stream.once('close', () => request.signal.removeEventListener('abort', cancel))
      return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
        status: header ? 206 : 200,
        headers
      })
    } catch {
      return new Response('视频文件无法读取。', { status: 404 })
    }
  })
}
export function registerVideoIPC(owner: WebContents, library: VideoLibrary): void {
  const handle = (name: string, fn: (...args: unknown[]) => unknown): void => {
    ipcMain.removeHandler(`videos:${name}`)
    ipcMain.handle(`videos:${name}`, (event, ...args: unknown[]) => {
      if (event.sender !== owner || event.senderFrame !== owner.mainFrame)
        throw new Error('不允许的请求来源。')
      return fn(...args)
    })
  }
  const importFiles = (paths: string[], categoryId: string): ReturnType<VideoLibrary['import']> =>
    library.import(paths, categoryId, (current, total, name) => {
      if (!owner.isDestroyed()) owner.send('videos:progress', { current, total, name })
    })
  handle('list', () => library.list())
  handle('import', (paths, categoryId) => importFiles(paths as string[], categoryId as string))
  handle('choose', async (categoryId) => {
    const window = BrowserWindow.fromWebContents(owner)
    if (!window) throw new Error('窗口已关闭。')
    const result = await dialog.showOpenDialog(window, {
      title: '添加到视频仓库',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: '视频文件', extensions: VIDEO_EXTENSIONS }]
    })
    return result.canceled ? null : importFiles(result.filePaths, categoryId as string)
  })
  handle('update', (id, patch) => library.update(id as string, patch as VideoPatch))
  handle('remove', (id) => library.remove(id as string))
  handle('category', (action, name, id) =>
    library.category(action as string, name as string, id as string | undefined)
  )
}
