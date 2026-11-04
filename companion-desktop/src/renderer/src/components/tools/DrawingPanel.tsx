import { registerLiveData } from '../companion/live-data'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Excalidraw,
  MainMenu,
  exportToBlob,
  loadFromBlob,
  serializeAsJSON,
  CaptureUpdateAction,
  newElementWith
} from '@excalidraw/excalidraw'
import type {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
  ExcalidrawProps
} from '@excalidraw/excalidraw/types'
import '@excalidraw/excalidraw/index.css'
import {
  DownloadSimpleIcon,
  UploadSimpleIcon,
  ImageIcon,
  PlusIcon,
  EraserIcon,
  PencilSimpleIcon
} from '@phosphor-icons/react'
import { downloadText, type ToolProps } from './tool-storage'
import { companionEvent } from '../companion/events'
import {
  readDrawing,
  readDrawingWorkspace,
  writeDrawingWorkspace,
  type DrawingWorkspace
} from './drawing-store'

function newScene(theme: 'day' | 'night'): { elements: never[]; appState: { viewBackgroundColor: string; currentItemStrokeColor: string } } {
  return {
    elements: [],
    appState: {
      viewBackgroundColor: theme === 'night' ? '#000000' : '#ffffff',
      currentItemStrokeColor: theme === 'night' ? '#ffffff' : '#1e1e1e'
    }
  }
}

export default function DrawingPanel({
  setCloseGuard,
  theme
}: ToolProps & { theme: 'day' | 'night' }): React.JSX.Element {
  const api = useRef<ExcalidrawImperativeAPI | null>(null)
  const workspace = useRef<DrawingWorkspace | null>(null)
  const [boards, setBoards] = useState<DrawingWorkspace['boards']>([])
  const [activeId, setActiveId] = useState('')
  const [busy, setBusy] = useState(false)
  const switching = useRef(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [background, setBackground] = useState('#ffffff')
  const initialTheme = useRef(theme)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const [initial, setInitial] = useState<ExcalidrawInitialDataState | null>(null)
  const [ready, setReady] = useState(false),
    [loadError, setLoadError] = useState('')
  const [status, setStatus] = useState('正在读取画稿…'),
    [error, setError] = useState('')
  const latest = useRef(''),
    saved = useRef('')
  const contentRevision = useRef('')
  useEffect(
    () =>
      registerLiveData('drawing', () => ({
        error: loadError,
        selectedIds: Object.keys(api.current?.getAppState().selectedElementIds || {}),
        workspace: workspace.current
          ? {
              ...workspace.current,
              boards: workspace.current.boards.map((board) =>
                board.id === workspace.current?.activeId
                  ? { ...board, scene: latest.current || board.scene }
                  : board
              )
            }
          : null
      })),
    [loadError]
  )
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const chain = useRef<Promise<boolean>>(Promise.resolve(true))
  const flush = useCallback((): Promise<boolean> => {
    clearTimeout(timer.current)
    chain.current = chain.current.then(async () => {
      // Closing can overlap an in-flight write; drain edits made during that write too.
      while (latest.current && latest.current !== saved.current) {
        const snapshot = latest.current
        try {
          if (!workspace.current) return false
          const current = workspace.current
          const next = {
            ...current,
            boards: current.boards.map((board) =>
              board.id === current.activeId ? { ...board, scene: snapshot } : board
            )
          }
          await writeDrawingWorkspace(next)
          workspace.current = next
          saved.current = snapshot
          setError('')
        } catch {
          setError('画稿保存失败，请重试或导出画稿备份；当前窗口会保留你的编辑。')
          setStatus('尚未保存')
          return false
        }
      }
      setStatus('画稿和图片已保存到这台电脑')
      return true
    })
    return chain.current
  }, [])
  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const library = await readDrawingWorkspace()
        const raw = library.boards.find((board) => board.id === library.activeId)?.scene
        const restored = raw
          ? await loadFromBlob(new Blob([raw], { type: 'application/json' }), null, null)
          : newScene(initialTheme.current)
        if (active) {
          workspace.current = library
          setBoards(library.boards)
          setActiveId(library.activeId)
          latest.current = saved.current = raw || ''
          setInitial(restored)
          setReady(true)
          setStatus('画稿自动保存到这台电脑')
        }
      } catch {
        if (active)
          setLoadError('画稿读取失败，原数据已保留。请重新打开画板；不会用空白画稿覆盖原数据。')
      }
    })()
    return () => {
      active = false
      clearTimeout(timer.current)
    }
  }, [])
  useEffect(() => {
    setCloseGuard(() => (switching.current ? false : flush()))
  }, [flush, setCloseGuard])
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent): void => {
      if (latest.current !== saved.current) {
        void flush()
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [flush])
  const change: NonNullable<ExcalidrawProps['onChange']> = (elements, state, files) => {
    if (switching.current) return
    setBackground(state.viewBackgroundColor)
    // Excalidraw also emits selection/viewport changes. Only content changes warrant feedback.
    const source = `${activeId}:${elements.map((e) => `${e.id}:${e.version}:${e.isDeleted}`).join('|')}`
    let hash = 2166136261
    for (let i = 0; i < source.length; i++) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619)
    const revision = `${activeId}:${hash >>> 0}`
    if (revision !== contentRevision.current) {
      contentRevision.current = revision
      const visible = elements.filter((e) => !e.isDeleted)
      const names: Record<string, string> = {
        ellipse: '圆形/椭圆',
        rectangle: '矩形',
        diamond: '菱形',
        freedraw: '自由笔画',
        line: '线条',
        arrow: '箭头',
        text: '文字块',
        image: '图片'
      }
      const counts = new Map<string, number>()
      for (const e of visible)
        counts.set(names[e.type] || e.type, (counts.get(names[e.type] || e.type) || 0) + 1)
      companionEvent({
        kind: 'drawing',
        detail: `画面变化：${
          Array.from(counts)
            .map(([name, count]) => `${count}个${name}`)
            .join('、') || '空白画布'
        }`,
        revision
      })
    }
    const snapshot = serializeAsJSON(elements, state, files, 'local')
    if (snapshot === latest.current) return
    latest.current = snapshot
    setStatus('正在保存…')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), 350)
  }
  const openBoard = async (id?: string, imported?: ExcalidrawInitialDataState): Promise<void> => {
    if (switching.current || !workspace.current) return
    if (id === workspace.current.activeId) return
    switching.current = true
    setBusy(true)
    try {
      if (!(await flush())) return
      const current = workspace.current
      const board = id
        ? current.boards.find((item) => item.id === id)!
        : {
            id: crypto.randomUUID(),
            name: `画布 ${current.boards.length + 1}`,
            scene: imported
              ? JSON.stringify({
                  type: 'excalidraw',
                  version: 2,
                  source: 'qijian',
                  elements: imported.elements || [],
                  appState: imported.appState || {},
                  files: imported.files || {}
                })
              : JSON.stringify({ type: 'excalidraw', version: 2, ...newScene(theme), files: {} })
          }
      const scene =
        imported ||
        (board.scene
          ? await loadFromBlob(new Blob([board.scene], { type: 'application/json' }), null, null)
          : newScene(theme))
      const next = {
        ...current,
        activeId: board.id,
        boards: id
          ? current.boards.map((item) => (item.id === id ? { ...item, closed: false } : item))
          : [...current.boards, board]
      }
      await writeDrawingWorkspace(next)
      if (!id) companionEvent({ kind: 'drawing', detail: '新建画布' })
      workspace.current = next
      latest.current = saved.current = board.scene || ''
      setInitial(scene)
      setBoards(next.boards)
      setActiveId(next.activeId)
      setConfirmClear(false)
      setRenaming(false)
      setError('')
    } catch {
      setError('画布切换或创建失败，当前画稿仍保留。请重试。')
    } finally {
      switching.current = false
      setBusy(false)
    }
  }
  const rename = async (): Promise<void> => {
    if (!name.trim() || switching.current || !workspace.current) return
    switching.current = true
    setBusy(true)
    try {
      if (!(await flush())) return
      const next = {
        ...workspace.current,
        boards: workspace.current.boards.map((board) =>
          board.id === activeId ? { ...board, name: name.trim() } : board
        )
      }
      await writeDrawingWorkspace(next)
      workspace.current = next
      setBoards(next.boards)
      setRenaming(false)
      setError('')
    } catch {
      setError('重命名未能保存，原名称已保留。')
    } finally {
      switching.current = false
      setBusy(false)
    }
  }
  const dismissBoard = async (remove: boolean): Promise<void> => {
    if (switching.current || !workspace.current || !activeId) return
    switching.current = true
    setBusy(true)
    try {
      if (!(await flush())) return
      const current = workspace.current
      const remaining = remove
        ? current.boards.filter((board) => board.id !== activeId)
        : current.boards.map((board) =>
            board.id === activeId ? { ...board, closed: true } : board
          )
      const nextBoard = remaining.find((board) => !board.closed)
      const scene = nextBoard?.scene
        ? await loadFromBlob(new Blob([nextBoard.scene], { type: 'application/json' }), null, null)
        : newScene(theme)
      const next = { ...current, boards: remaining, activeId: nextBoard?.id || '' }
      await writeDrawingWorkspace(next)
      workspace.current = next
      latest.current = saved.current = nextBoard?.scene || ''
      api.current = null
      setInitial(scene)
      setBoards(remaining)
      setActiveId(next.activeId)
      setConfirmDelete(false)
      setConfirmClear(false)
      setRenaming(false)
      companionEvent({ kind: 'drawing', detail: remove ? '删除画布' : '关闭画布，画稿保留' })
    } catch {
      setError('画布操作保存失败，原画稿已保留。')
    } finally {
      switching.current = false
      setBusy(false)
    }
  }
  const setCanvasColor = (color: string): void => {
    api.current?.updateScene({
      appState: { viewBackgroundColor: color },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY
    })
  }
  if (loadError)
    return (
      <div className="tool-empty">
        <p className="tool-error" role="alert">
          {loadError}
        </p>
        <button
          onClick={async () => {
            try {
              const raw = (await readDrawing('workspace')) || (await readDrawing())
              if (raw) downloadText('栖间-画稿恢复备份.json', raw)
            } catch {
              setError('暂时无法访问画稿存储，请重新启动应用后再试。')
            }
          }}
        >
          导出原始画稿
        </button>
        {error && <p role="alert">{error}</p>}
      </div>
    )
  if (!ready)
    return (
      <p className="tool-loading" role="status">
        正在铺开画纸…
      </p>
    )
  return (
    <div className="drawing-panel">
      <div className="drawing-tabbar">
        <div className="drawing-tabs" role="tablist" aria-label="我的画布">
          {boards
            .filter((board) => !board.closed)
            .map((board) => (
              <button
                key={board.id}
                role="tab"
                aria-selected={board.id === activeId}
                aria-controls="active-drawing-panel"
                id={`board-tab-${board.id}`}
                disabled={busy}
                onClick={() => void openBoard(board.id)}
              >
                {board.name}
              </button>
            ))}
        </div>
        <button className="drawing-new" disabled={busy} onClick={() => void openBoard()}>
          <PlusIcon size={17} />
          新建画布
        </button>
      </div>
      <label className="drawing-library">
        重新打开画布
        <select
          aria-label="重新打开画布"
          value=""
          disabled={busy}
          onChange={(event) => void openBoard(event.target.value)}
        >
          <option value="" disabled>
            选择已关闭的画布
          </option>
          {boards
            .filter((board) => board.closed)
            .map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
        </select>
      </label>
      {activeId && (
        <div className="drawing-toolbar">
          <p role="status">{status}</p>
          <div className="tool-actions">
            <button disabled={busy} onClick={() => void dismissBoard(false)}>
              关闭画布
            </button>
            <button disabled={busy} onClick={() => setConfirmDelete(true)}>
              删除画布
            </button>
            <button disabled={busy} onClick={() => setConfirmClear(true)}>
              <EraserIcon />
              清空当前画布
            </button>
            <button
              disabled={busy}
              onClick={() => {
                setName(boards.find((board) => board.id === activeId)!.name)
                setRenaming(true)
              }}
            >
              <PencilSimpleIcon />
              重命名
            </button>
            <button onClick={() => fileInput.current?.click()}>
              <UploadSimpleIcon />
              打开画稿
            </button>
            <button
              onClick={() => {
                if (latest.current) downloadText('栖间-画稿.excalidraw', latest.current)
              }}
            >
              <DownloadSimpleIcon />
              导出画稿
            </button>
            <button
              onClick={async () => {
                if (!api.current) return
                try {
                  const blob = await exportToBlob({
                    elements: api.current.getSceneElements(),
                    appState: { ...api.current.getAppState(), exportBackground: true },
                    files: api.current.getFiles(),
                    mimeType: 'image/png'
                  })
                  const url = URL.createObjectURL(blob),
                    a = document.createElement('a')
                  a.href = url
                  a.download = '栖间-画板.png'
                  a.click()
                  setTimeout(() => URL.revokeObjectURL(url), 10000)
                } catch {
                  setError('图片导出失败。请确认画板上有内容，或先导出画稿。')
                }
              }}
            >
              <ImageIcon />
              导出图片
            </button>
          </div>
        </div>
      )}
      {activeId && (
        <div className="drawing-colors" aria-label="画布背景颜色">
          <span>画布背景</span>
          {[
            '#ffffff',
            '#000000',
            '#fff3bf',
            '#d3f9d8',
            '#d0ebff',
            '#e5dbff',
            '#ffe3e3',
            '#868e96'
          ].map((color) => (
            <button
              key={color}
              aria-label={`背景 ${color}`}
              aria-pressed={background === color}
              style={{ background: color }}
              disabled={busy}
              onClick={() => setCanvasColor(color)}
            />
          ))}
          <label>
            自定义颜色{' '}
            <input
              aria-label="自定义背景颜色"
              type="color"
              value={background.length === 7 ? background : '#ffffff'}
              onChange={(event) => setCanvasColor(event.target.value)}
            />
          </label>
          <code>{background}</code>
        </div>
      )}
      {confirmDelete && (
        <div role="alertdialog" aria-label="删除画布确认" className="drawing-clear-confirm">
          <p>删除当前画布及其内容？删除后无法恢复，请先导出需要保留的画稿。</p>
          <button disabled={busy} onClick={() => setConfirmDelete(false)}>
            取消
          </button>
          <button disabled={busy} onClick={() => void dismissBoard(true)}>
            确认删除画布
          </button>
        </div>
      )}
      {renaming && (
        <form
          className="drawing-inline-form"
          onSubmit={(event) => {
            event.preventDefault()
            void rename()
          }}
        >
          <label htmlFor="drawing-name">画布名称</label>
          <input
            id="drawing-name"
            autoFocus
            value={name}
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <button disabled={busy}>保存名称</button>
          <button type="button" onClick={() => setRenaming(false)}>
            取消
          </button>
        </form>
      )}
      {confirmClear && (
        <div className="drawing-clear-confirm" role="alertdialog" aria-label="清空当前画布确认">
          <p>
            清空当前画布？其他画布不受影响，重置会清空内容并恢复当前时段的默认背景，可按 Ctrl+Z
            撤销。
          </p>
          <button onClick={() => setConfirmClear(false)}>取消</button>
          <button
            onClick={() => {
              if (api.current)
                api.current.updateScene({
                  elements: api.current
                    .getSceneElements()
                    .map((element) => newElementWith(element, { isDeleted: true })),
                  appState: {
                    ...newScene(theme).appState,
                    scrollX: 0,
                    scrollY: 0,
                    zoom: { value: 1 as never }
                  },
                  captureUpdate: CaptureUpdateAction.IMMEDIATELY
                })
              setConfirmClear(false)
            }}
          >
            确认清空
          </button>
        </div>
      )}
      {error && (
        <p className="tool-error" role="alert">
          {error}
          <button onClick={() => void flush()}>重试保存</button>
        </p>
      )}
      <input
        hidden
        ref={fileInput}
        type="file"
        accept=".excalidraw,.json"
        onChange={async (event) => {
          const chosen = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (!chosen || !api.current) return
          try {
            if (chosen.size > 30_000_000) throw new Error('too large')
            const scene = await loadFromBlob(chosen, null, null)
            await openBoard(undefined, scene)
          } catch {
            setError('无法打开画稿，请选择不超过 30 MB 的有效 .excalidraw 文件。')
          }
        }}
      />
      <div
        className="drawing-canvas"
        data-testid="drawing-canvas"
        id="active-drawing-panel"
        role="tabpanel"
        aria-labelledby={`board-tab-${activeId}`}
        inert={busy}
      >
        {activeId ? (
          <Excalidraw
            key={activeId}
            autoFocus
            excalidrawAPI={(instance) => {
              api.current = instance
            }}
            initialData={initial}
            onChange={change}
            langCode="zh-CN"
            theme="light"
            aiEnabled={false}
            isCollaborating={false}
            onLinkOpen={(_element, event) => event.preventDefault()}
            UIOptions={{
              canvasActions: {
                loadScene: false,
                saveToActiveFile: false,
                export: false,
                saveAsImage: false,
                toggleTheme: false
              }
            }}
          >
            <MainMenu>
              <MainMenu.Item onSelect={() => setConfirmClear(true)}>重置画布</MainMenu.Item>
              <MainMenu.ItemLink href="https://github.com/excalidraw/excalidraw">
                GitHub
              </MainMenu.ItemLink>
              <MainMenu.DefaultItems.ChangeCanvasBackground />
            </MainMenu>
          </Excalidraw>
        ) : (
          <div className="tool-empty">画布已关闭。可新建画布，或从上方重新打开已保存的画稿。</div>
        )}
      </div>
    </div>
  )
}

