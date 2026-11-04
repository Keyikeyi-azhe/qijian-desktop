import { createHash, randomUUID } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join, isAbsolute } from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import {
  VIDEO_EXTENSIONS,
  type VideoItem,
  type VideoLibraryState,
  type VideoPatch,
  type VideoImportResult
} from '../shared/videos'

function label(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.trim().length > 120 ||
    [...value].some((char) => char.charCodeAt(0) < 32)
  )
    throw new Error('名称需为1—120个字符。')
  return value.trim()
}
function validId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9-]{1,80}$/.test(value)
}
export class VideoLibrary {
  private state: VideoLibraryState = { version: 1, items: [], categories: [] }
  private ready: Promise<void>
  private queue: Promise<unknown> = Promise.resolve()
  constructor(readonly root: string, private readonly seedRoot?: string) {
    this.ready = this.load()
    void this.ready.catch(() => {})
  }
  private async load(): Promise<void> {
    await mkdir(this.root, { recursive: true })
    let raw: string
    let firstRun = false
    try {
      raw = await readFile(join(this.root, 'library.json'), 'utf8')
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
      if (!this.seedRoot) return
      raw = await readFile(join(this.seedRoot, 'library.json'), 'utf8')
      firstRun = true
    }
    const data = JSON.parse(raw) as VideoLibraryState
    if (data.version !== 1 || !Array.isArray(data.items) || !Array.isArray(data.categories))
      throw new Error('视频目录读取失败，原文件已保留。')
    const ids = new Set<string>(),
      categories = new Set<string>()
    for (const c of data.categories) {
      if (!validId(c.id) || categories.has(c.id)) throw new Error('视频分类资料损坏。')
      label(c.name)
      categories.add(c.id)
    }
    for (const v of data.items) {
      if (
        !validId(v.id) ||
        ids.has(v.id) ||
        !VIDEO_EXTENSIONS.some((ext) => v.filename === `${v.id}.${ext}`) ||
        !Number.isSafeInteger(v.size) ||
        v.size <= 0 ||
        !/^[a-f0-9]{64}$/.test(v.hash) ||
        (v.categoryId !== '' && !categories.has(v.categoryId)) ||
        !Number.isFinite(v.duration) ||
        v.duration < 0 ||
        !Number.isFinite(v.position) ||
        v.position < 0 ||
        !Number.isFinite(Date.parse(v.addedAt))
      )
        throw new Error('视频目录资料损坏，原文件已保留。')
      label(v.title)
      ids.add(v.id)
    }
    if (firstRun && this.seedRoot) {
      for (const item of data.items)
        await copyFile(join(this.seedRoot, item.filename), join(this.root, item.filename))
      await this.commit(data)
    } else {
      this.state = data
    }
  }
  private async commit(next: VideoLibraryState): Promise<VideoLibraryState> {
    const temp = join(this.root, 'library.json.tmp')
    await writeFile(temp, JSON.stringify(next), 'utf8')
    await rename(temp, join(this.root, 'library.json'))
    this.state = next
    return structuredClone(next)
  }
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(async () => {
      await this.ready
      return fn()
    })
    this.queue = next.catch(() => {})
    return next
  }
  async list(): Promise<VideoLibraryState> {
    await this.ready
    return structuredClone(this.state)
  }
  async file(id: string): Promise<{ path: string; item: VideoItem }> {
    await this.ready
    const item = this.state.items.find((v) => v.id === id)
    if (!item) throw new Error('视频不存在。')
    return { path: join(this.root, item.filename), item }
  }
  private categoryExists(id: string): void {
    if (id !== '' && !this.state.categories.some((c) => c.id === id))
      throw new Error('分类不存在，请重新选择。')
  }
  import(
    paths: string[],
    categoryId: string,
    progress: (current: number, total: number, name: string) => void
  ): Promise<VideoImportResult> {
    return this.serial(async () => {
      this.categoryExists(categoryId)
      if (!Array.isArray(paths) || paths.length < 1 || paths.length > 100)
        throw new Error('每次请选择1—100个视频文件。')
      let imported = 0,
        duplicates = 0
      const errors: string[] = []
      for (const [index, source] of paths.entries()) {
        let temporary = '',
          copied = ''
        try {
          if (typeof source !== 'string' || !isAbsolute(source))
            throw new Error('只支持从本机拖入真实文件。')
          progress(index + 1, paths.length, basename(source))
          const ext = extname(source).toLowerCase().slice(1)
          if (!VIDEO_EXTENSIONS.includes(ext)) throw new Error('不是支持的视频文件类型。')
          const info = await stat(source)
          if (!info.isFile() || info.size <= 0) throw new Error('文件为空或不是普通文件。')
          if (this.state.items.length >= 5000) throw new Error('视频仓库最多5000条，请先整理。')
          const id = randomUUID(),
            hash = createHash('sha256')
          temporary = join(this.root, `${id}.part`)
          await pipeline(
            createReadStream(source),
            new Transform({
              transform(chunk, _encoding, callback) {
                hash.update(chunk)
                callback(null, chunk)
              }
            }),
            createWriteStream(temporary, { flags: 'wx' })
          )
          const digest = hash.digest('hex')
          if (this.state.items.some((v) => v.hash === digest)) {
            duplicates++
            await rm(temporary)
            temporary = ''
            continue
          }
          const filename = `${id}.${ext}`
          copied = join(this.root, filename)
          await rename(temporary, copied)
          temporary = ''
          const item: VideoItem = {
            id,
            title:
              [...basename(source, extname(source)).slice(0, 120)]
                .filter((char) => char.charCodeAt(0) >= 32)
                .join('')
                .trim() || '未命名视频',
            categoryId,
            filename,
            hash: digest,
            size: (await stat(copied)).size,
            addedAt: new Date().toISOString(),
            duration: 0,
            position: 0
          }
          await this.commit({ ...this.state, items: [item, ...this.state.items] })
          copied = ''
          imported++
        } catch (e) {
          if (temporary) await rm(temporary, { force: true }).catch(() => {})
          if (copied) await rm(copied, { force: true }).catch(() => {})
          errors.push(
            `${typeof source === 'string' ? basename(source) : '文件'}：${e instanceof Error ? e.message : '导入失败'}`
          )
        }
      }
      return { library: await this.list(), imported, duplicates, errors }
    })
  }
  update(id: string, patch: VideoPatch): Promise<VideoLibraryState> {
    return this.serial(async () => {
      const item = this.state.items.find((v) => v.id === id)
      if (!item) throw new Error('视频不存在。')
      if (
        !patch ||
        typeof patch !== 'object' ||
        Object.keys(patch).some((k) => !['title', 'categoryId', 'duration', 'position'].includes(k))
      )
        throw new Error('视频更新参数无效。')
      const next = { ...item }
      if (patch.title !== undefined) next.title = label(patch.title)
      if (patch.categoryId !== undefined) {
        this.categoryExists(patch.categoryId)
        next.categoryId = patch.categoryId
      }
      for (const field of ['duration', 'position'] as const) {
        const value = patch[field]
        if (value !== undefined) {
          if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 31536000)
            throw new Error('播放进度无效。')
          next[field] = value
        }
      }
      return this.commit({
        ...this.state,
        items: this.state.items.map((v) => (v.id === id ? next : v))
      })
    })
  }
  category(action: string, name: string, id?: string): Promise<VideoLibraryState> {
    return this.serial(async () => {
      if (!['add', 'rename', 'remove'].includes(action)) throw new Error('分类操作无效。')
      if (action !== 'add' && !this.state.categories.some((c) => c.id === id))
        throw new Error('分类不存在。')
      if (action === 'remove')
        return this.commit({
          ...this.state,
          categories: this.state.categories.filter((c) => c.id !== id),
          items: this.state.items.map((v) => (v.categoryId === id ? { ...v, categoryId: '' } : v))
        })
      const title = label(name)
      if (
        this.state.categories.some(
          (c) => c.id !== id && c.name.toLowerCase() === title.toLowerCase()
        )
      )
        throw new Error('已有同名分类。')
      if (action === 'add' && this.state.categories.length >= 100)
        throw new Error('最多100个分类。')
      return this.commit({
        ...this.state,
        categories:
          action === 'add'
            ? [...this.state.categories, { id: randomUUID(), name: title }]
            : this.state.categories.map((c) => (c.id === id ? { ...c, name: title } : c))
      })
    })
  }
  remove(id: string): Promise<VideoLibraryState> {
    return this.serial(async () => {
      const { path } = await this.file(id)
      // A reversible rename lets a manifest failure restore the managed copy.
      const pending = `${path}.removed`
      await rename(path, pending)
      let result: VideoLibraryState
      try {
        result = await this.commit({
          ...this.state,
          items: this.state.items.filter((v) => v.id !== id)
        })
      } catch (e) {
        await rename(pending, path)
        throw e
      }
      await rm(pending).catch(() => {})
      return result
    })
  }
}
