import './drawing-assets'
import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeftIcon } from '@phosphor-icons/react'
import type { CloseGuard, DeskTool } from './tool-storage'
import './tools.css'

const NotesPanel = lazy(() => import('./NotesPanel'))
const DrawingPanel = lazy(() => import('./DrawingPanel'))
const VocabularyPanel = lazy(() => import('./VocabularyPanel'))
const VideoPanel = lazy(() => import('./VideoPanel'))
class ToolBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false }
  static getDerivedStateFromError(): { error: boolean } {
    return { error: true }
  }
  render(): ReactNode {
    return this.state.error ? (
      <p className="tool-error" role="alert">
        工具未能加载。请回到书桌后重新打开，已保存的数据不会被清除。
      </p>
    ) : (
      this.props.children
    )
  }
}
export function DeskTools({
  tool,
  theme,
  onClose
}: {
  tool: DeskTool
  theme: 'day' | 'night'
  onClose: () => void
}): React.JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null)
  const guard = useRef<CloseGuard>(() => true)
  const closing = useRef(false)
  const [notice, setNotice] = useState('')
  const setCloseGuard = useCallback((next: CloseGuard) => {
    guard.current = next
  }, [])
  useEffect(() => {
    const element = dialog.current!,
      previous = document.activeElement
    element.showModal()
    return () => {
      element.close()
      if (previous instanceof HTMLElement || previous instanceof SVGElement) previous.focus()
    }
  }, [])
  const close = async (): Promise<void> => {
    if (closing.current) return
    closing.current = true
    try {
      if (await guard.current()) onClose()
      else setNotice('还有未保存的编辑，请先重试保存。')
    } finally {
      closing.current = false
    }
  }
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent): void => {
      const result = guard.current()
      if (result === false) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [])
  return createPortal(
    <dialog
      ref={dialog}
      className={`tool-dialog tool-dialog-${tool}`}
      data-theme={theme}
      aria-labelledby="desk-tool-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!dialog.current?.querySelector('.excalidraw .Modal')) void close()
      }}
    >
      <header className="tool-header">
        <button className="tool-back" onClick={() => void close()}>
          <ArrowLeftIcon size={18} />
          回到书桌
        </button>
        <h1 id="desk-tool-title">
          {
            {
              memo: '我的便签',
              'drawing-tools': '我的画板',
              vocabulary: '背单词',
              tablet: '视频仓库'
            }[tool]
          }
        </h1>
        <span>栖间 · 留一点自己的时间</span>
      </header>
      {notice && (
        <p className="tool-error" role="alert">
          {notice}
        </p>
      )}
      <div className="tool-body">
        <ToolBoundary>
          <Suspense
            fallback={
              <p className="tool-loading" role="status">
                正在打开…
              </p>
            }
          >
            {tool === 'memo' && <NotesPanel setCloseGuard={setCloseGuard} />}
            {tool === 'drawing-tools' && (
              <DrawingPanel theme={theme} setCloseGuard={setCloseGuard} />
            )}
            {tool === 'vocabulary' && <VocabularyPanel setCloseGuard={setCloseGuard} />}
            {tool === 'tablet' && <VideoPanel setCloseGuard={setCloseGuard} />}
          </Suspense>
        </ToolBoundary>
      </div>
      <footer className="tool-attribution">
        {tool === 'drawing-tools'
          ? 'Excalidraw · MIT'
          : tool === 'vocabulary'
            ? '复习引擎 ts-fsrs · MIT / 四六级词表 KyleBing · BSD-3-Clause'
            : tool === 'tablet'
              ? '栖间视频 · 本地存放与播放'
              : '栖间便签 · 本地保存'}
        <details>
          <summary>开源说明</summary>
          <p>
            感谢 Excalidraw 与 ts-fsrs 开源社区。画板和复习引擎的版权及完整许可证随应用保留。
            便签与示例词条由栖间制作。四六级词表来自 KyleBing/english-vocabulary，按 BSD-3-Clause
            保留完整许可证。
          </p>
        </details>
      </footer>
    </dialog>,
    document.body
  )
}
