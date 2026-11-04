import { useEffect, useRef, useState } from 'react'
import {
  FilmStripIcon,
  FolderPlusIcon,
  UploadSimpleIcon,
  PencilSimpleIcon,
  TrashIcon,
  PlayIcon
} from '@phosphor-icons/react'
import {
  VIDEO_EXTENSIONS,
  videoURL,
  type VideoItem,
  type VideoLibraryState,
  type VideoImportResult
} from '../../../../shared/videos'
import { registerLiveData } from '../companion/live-data'
import { companionEvent } from '../companion/events'
import type { ToolProps } from './tool-storage'
import './videos.css'

const bytes = (n: number): string =>
  n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(1)} GB` : `${(n / 1024 ** 2).toFixed(1)} MB`
const duration = (n: number): string =>
  `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`
export default function VideoPanel({ setCloseGuard }: ToolProps): React.JSX.Element {
  const [library, setLibrary] = useState<VideoLibraryState | null>(null)
  const [category, setCategory] = useState('all'),
    [query, setQuery] = useState('')
  const [selected, setSelected] = useState(''),
    [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(''),
    [error, setError] = useState(''),
    [playError, setPlayError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [edit, setEdit] = useState<{
    kind: 'video' | 'category'
    id: string
    value: string
  } | null>(null)
  const input = useRef<HTMLInputElement>(null),
    player = useRef<HTMLVideoElement>(null)
  const dragDepth = useRef(0),
    progressAt = useRef(0)
  const playback = useRef({ id: '', position: 0, duration: 0, playing: false, error: '' })
  const current = library?.items.find((v) => v.id === selected)
  const reload = async (): Promise<void> => {
    try {
      if (!window.videos) throw new Error('请在栖间桌面程序中打开视频仓库。')
      setLibrary(await window.videos.list())
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '视频仓库未能读取。')
    }
  }
  useEffect(() => {
    let live = true
    const reading = window.videos
      ? window.videos.list()
      : Promise.reject(new Error('请在栖间桌面程序中打开视频仓库。'))
    void reading
      .then((value) => {
        if (live) setLibrary(value)
      })
      .catch((e) => {
        if (live) setError(e instanceof Error ? e.message : '视频仓库未能读取。')
      })
    const unsubscribe = window.videos?.onProgress((p) =>
      setNotice(`正在存放 ${p.current}/${p.total}：${p.name}`)
    )
    return () => {
      live = false
      unsubscribe?.()
    }
  }, [])
  const persist = async (): Promise<void> => {
    const node = player.current
    if (
      !node ||
      !node.isConnected ||
      node.readyState === 0 ||
      !selected ||
      !Number.isFinite(node.duration) ||
      node.duration <= 0
    )
      return
    const next = await window.videos!.update(selected, {
      position: node.ended && node.currentTime >= node.duration - 0.1 ? 0 : node.currentTime,
      duration: node.duration
    })
    setLibrary(next)
  }
  useEffect(() => {
    setCloseGuard(async () => {
      if (busy) return false
      try {
        await persist()
        return true
      } catch {
        setError('播放进度保存失败，请重试后返回。')
        return false
      }
    })
  })
  useEffect(
    () =>
      registerLiveData('videos', () => ({
        library,
        current: { ...playback.current },
        category,
        error
      })),
    [library, category, error]
  )
  const run = async (work: () => Promise<VideoLibraryState>, message: string): Promise<void> => {
    setBusy(true)
    setError('')
    try {
      setLibrary(await work())
      setNotice(message)
      companionEvent({ kind: 'video', detail: message })
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作未完成。')
    } finally {
      setBusy(false)
    }
  }
  const imported = (result: VideoImportResult): void => {
    setLibrary(result.library)
    setNotice(
      `已存放 ${result.imported} 个视频${result.duplicates ? `，跳过 ${result.duplicates} 个重复文件` : ''}。`
    )
    setError(result.errors.join('\n'))
    if (result.imported)
      companionEvent({ kind: 'video', detail: `导入了${result.imported}个本地视频` })
  }
  const addFiles = async (files: File[]): Promise<void> => {
    if (busy || !library || !files.length) return
    setBusy(true)
    setError('')
    setNotice('准备存放视频…')
    try {
      imported(await window.videos!.importFiles(files, category === 'all' ? '' : category))
    } catch (e) {
      setError(e instanceof Error ? e.message : '导入未完成。')
    } finally {
      setBusy(false)
    }
  }
  const selectVideo = async (item: VideoItem): Promise<void> => {
    try {
      await persist()
    } catch {
      setError('上一个视频的进度未能保存。')
      return
    }
    setSelected(item.id)
    setPlayError('')
    playback.current = {
      id: item.id,
      position: item.position,
      duration: item.duration,
      playing: false,
      error: ''
    }
    progressAt.current = 0
    companionEvent({ kind: 'video', detail: `打开视频：${item.title.slice(0, 80)}` })
  }
  const filtered =
    library?.items.filter(
      (v) =>
        (category === 'all' || v.categoryId === category) &&
        v.title.toLowerCase().includes(query.trim().toLowerCase())
    ) || []
  const activeCategory = library?.categories.find((c) => c.id === category)
  return (
    <div
      className={`video-library${dragging ? ' is-dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = busy ? 'none' : 'copy'
      }}
      onDragEnter={(e) => {
        e.preventDefault()
        if (e.dataTransfer.types.includes('Files')) {
          dragDepth.current++
          setDragging(true)
        }
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        if (--dragDepth.current <= 0) {
          dragDepth.current = 0
          setDragging(false)
        }
      }}
      onDrop={(e) => {
        e.preventDefault()
        dragDepth.current = 0
        setDragging(false)
        void addFiles(Array.from(e.dataTransfer.files))
      }}
    >
      <div className="video-heading">
        <div>
          <p className="tool-eyebrow">留一点时间，看看喜欢的</p>
          <h2>我的视频仓库</h2>
          <p>视频保存在这台电脑，移动原文件也不影响播放。</p>
        </div>
        <button
          className="tool-primary"
          disabled={busy || !library}
          onClick={() => input.current?.click()}
        >
          <UploadSimpleIcon aria-hidden />
          选择视频导入
        </button>
        <input
          ref={input}
          data-testid="video-import"
          hidden
          type="file"
          multiple
          accept={VIDEO_EXTENSIONS.map((ext) => `.${ext}`).join(',')}
          onChange={(e) => {
            const files = Array.from(e.target.files || [])
            e.target.value = ''
            void addFiles(files)
          }}
        />
      </div>
      <div className="video-toolbar">
        <label>
          搜索视频
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="按视频名称查找"
          />
        </label>
        <span>
          {library?.items.length || 0} 个视频 ·{' '}
          {bytes(library?.items.reduce((n, v) => n + v.size, 0) || 0)}
        </span>
      </div>
      {notice && (
        <p className="tool-notice" role="status">
          {notice}
        </p>
      )}
      {busy && <progress aria-label="正在处理视频" />}
      {error && (
        <p className="tool-error" role="alert">
          {error}
          {!library && <button onClick={() => void reload()}>重新读取</button>}
        </p>
      )}
      <div className="video-categories" role="group" aria-label="视频分类">
        <button aria-pressed={category === 'all'} onClick={() => setCategory('all')}>
          全部 {library?.items.length || 0}
        </button>
        <button aria-pressed={category === ''} onClick={() => setCategory('')}>
          未分类 {library?.items.filter((v) => !v.categoryId).length || 0}
        </button>
        {library?.categories.map((c) => (
          <button key={c.id} aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>
            {c.name} {library.items.filter((v) => v.categoryId === c.id).length}
          </button>
        ))}
        <button
          disabled={busy || !library}
          onClick={() => setEdit({ kind: 'category', id: '', value: '' })}
        >
          <FolderPlusIcon aria-hidden />
          新建分类
        </button>
      </div>
      {activeCategory && (
        <div className="video-category-actions">
          <span>当前分类：{activeCategory.name}</span>
          <button
            disabled={busy}
            onClick={() => setEdit({ kind: 'category', id: category, value: activeCategory.name })}
          >
            重命名分类
          </button>
          <button
            disabled={busy}
            onClick={() => {
              if (window.confirm('删除这个分类？里面的视频会移至“未分类”，不会删除视频。'))
                void run(async () => {
                  const next = await window.videos!.category('remove', '', category)
                  setCategory('')
                  return next
                }, '分类已移除，视频保留在未分类。')
            }}
          >
            删除分类
          </button>
        </div>
      )}
      {edit && (
        <form
          className="video-edit"
          onSubmit={(e) => {
            e.preventDefault()
            void run(async () => {
              const next =
                edit.kind === 'video'
                  ? await window.videos!.update(edit.id, { title: edit.value })
                  : await window.videos!.category(
                      edit.id ? 'rename' : 'add',
                      edit.value,
                      edit.id || undefined
                    )
              setEdit(null)
              return next
            }, '名称已保存。')
          }}
        >
          <label>
            {edit.kind === 'video' ? '视频名称' : '分类名称'}
            <input
              autoFocus
              required
              maxLength={120}
              value={edit.value}
              onChange={(e) => setEdit({ ...edit, value: e.target.value })}
            />
          </label>
          <button className="tool-primary" disabled={busy}>
            保存名称
          </button>
          <button type="button" disabled={busy} onClick={() => setEdit(null)}>
            取消
          </button>
        </form>
      )}
      {current && (
        <section className="video-player" aria-label="视频播放器">
          <video
            key={current.id}
            ref={player}
            src={videoURL(current.id)}
            controls
            autoPlay
            preload="metadata"
            onLoadedMetadata={(e) => {
              const node = e.currentTarget
              if (current.position > 0 && current.position < node.duration - 2)
                node.currentTime = current.position
              playback.current.duration = Number.isFinite(node.duration) ? node.duration : 0
              void persist().catch(() => setError('视频时长未能保存。'))
            }}
            onTimeUpdate={(e) => {
              const node = e.currentTarget
              playback.current.position = node.currentTime
              if (Date.now() - progressAt.current > 10000) {
                progressAt.current = Date.now()
                void persist().catch(() => setError('播放进度未能保存。'))
              }
            }}
            onPlay={() => {
              playback.current.playing = true
            }}
            onPause={() => {
              playback.current.playing = false
              void persist().catch(() => setError('播放进度未能保存。'))
            }}
            onSeeked={(e) => {
              playback.current.position = e.currentTarget.currentTime
              void persist().catch(() => setError('播放进度未能保存。'))
            }}
            onEnded={() => {
              playback.current.playing = false
              playback.current.position = 0
              void persist().catch(() => setError('播放进度未能保存。'))
            }}
            onError={() => {
              const message =
                '这个视频暂时无法播放。可能是文件损坏或编码不受支持，可尝试 MP4（H.264/AAC）或 WebM；文件仍保存在仓库中。'
              setPlayError(message)
              playback.current.error = message
              playback.current.playing = false
            }}
          />
          <div>
            <h3>{current.title}</h3>
            <label>
              播放速度
              <select
                defaultValue="1"
                key={current.id}
                onChange={(e) => {
                  if (player.current) player.current.playbackRate = Number(e.target.value)
                }}
              >
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((n) => (
                  <option key={n} value={n}>
                    {n}×
                  </option>
                ))}
              </select>
            </label>
          </div>
          {playError && (
            <p className="tool-error" role="alert">
              {playError}
            </p>
          )}
        </section>
      )}
      {!library && !error ? (
        <p className="tool-loading">正在打开视频仓库…</p>
      ) : !filtered.length ? (
        <div className="video-empty">
          <FilmStripIcon size={48} aria-hidden />
          <h3>{library?.items.length ? '没有匹配的视频' : '这里还空着，放一段喜欢的视频吧'}</h3>
          <p>把视频文件拖进来，或点击“选择视频导入”。</p>
          <small>支持常见视频容器；实际播放取决于文件编码。不会上传视频到云端。</small>
        </div>
      ) : (
        <div className="video-grid">
          {filtered.map((item) => (
            <article key={item.id} className={selected === item.id ? 'is-selected' : ''}>
              <button
                className="video-card-play"
                disabled={busy}
                aria-label={`播放：${item.title}`}
                onClick={() => void selectVideo(item)}
              >
                <span className="video-cover">
                  <FilmStripIcon size={32} aria-hidden />
                  <PlayIcon size={22} aria-hidden />
                </span>
                <strong>{item.title}</strong>
              </button>
              <p>
                {bytes(item.size)} ·{' '}
                {item.duration
                  ? duration(item.duration)
                  : item.filename.split('.').at(-1)?.toUpperCase()}{' '}
                <span>{new Date(item.addedAt).toLocaleDateString('zh-CN')}</span>
              </p>
              <label>
                分类
                <select
                  aria-label={`分类：${item.title}`}
                  value={item.categoryId}
                  disabled={busy}
                  onChange={(e) =>
                    void run(
                      () => window.videos!.update(item.id, { categoryId: e.target.value }),
                      '视频分类已更新。'
                    )
                  }
                >
                  <option value="">未分类</option>
                  {library?.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="video-card-actions">
                <button
                  disabled={busy}
                  aria-label={`重命名：${item.title}`}
                  onClick={() => setEdit({ kind: 'video', id: item.id, value: item.title })}
                >
                  <PencilSimpleIcon aria-hidden />
                  重命名
                </button>
                <button
                  disabled={busy}
                  aria-label={`删除：${item.title}`}
                  onClick={() => {
                    if (
                      window.confirm(
                        `从视频仓库删除“${item.title}”？只删除仓库副本，原始文件不受影响。`
                      )
                    ) {
                      if (selected === item.id) {
                        player.current?.pause()
                        setSelected('')
                        playback.current = {
                          id: '',
                          position: 0,
                          duration: 0,
                          playing: false,
                          error: ''
                        }
                      }
                      void run(() => window.videos!.remove(item.id), '已删除仓库副本。')
                    }
                  }}
                >
                  <TrashIcon aria-hidden />
                  移除
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {dragging && (
        <div className="video-drop-overlay" aria-hidden>
          {busy ? '正在处理，请稍等' : '松开鼠标，存放到当前分类'}
        </div>
      )}
    </div>
  )
}
