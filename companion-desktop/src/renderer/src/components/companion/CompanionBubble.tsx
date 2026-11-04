import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { CompanionController } from './useCompanion'
import type { Bounds } from '../pet/pet-model'
import { bubbleLayout, type PetRectangle } from './bubble-layout'

export function CompanionBubble({
  chat,
  bounds,
  pet
}: {
  chat: CompanionController
  bounds: Bounds
  pet: PetRectangle
}): React.JSX.Element {
  const root = useRef<HTMLElement>(null),
    content = useRef<HTMLParagraphElement>(null)
  const [size, setSize] = useState({ width: 230, height: 60 })
  const follow = useRef(true)
  const setBubbleHeld = chat.setBubbleHeld
  useEffect(() => () => setBubbleHeld(false), [setBubbleHeld])
  useLayoutEffect(() => {
    const measure = (): void => {
      if (!root.current) return
      const { offsetWidth: width, offsetHeight: height } = root.current
      setSize((old) => (old.width === width && old.height === height ? old : { width, height }))
    }
    const observer = new ResizeObserver(measure)
    if (root.current) observer.observe(root.current)
    measure()
    return () => observer.disconnect()
  }, [])
  useLayoutEffect(() => {
    if (content.current && follow.current) content.current.scrollTop = content.current.scrollHeight
  }, [chat.bubble])
  const layout = bubbleLayout(bounds, pet, size)
  const fonts = {
    rounded: '"ShangshouSoftCandy", "YouYuan", "Microsoft YaHei", sans-serif',
    system: 'system-ui, sans-serif',
    serif: '"SimSun", serif'
  }
  return (
    <aside
      ref={root}
      className={`companion-bubble is-${layout.side}`}
      data-side={layout.side}
      aria-label="波奇酱的回答"
      style={
        {
          left: layout.left,
          top: layout.top,
          maxWidth: Math.min(
            230,
            layout.side === 'above'
              ? bounds.width - 16
              : layout.side === 'right'
                ? bounds.width - pet.right - 20
                : pet.left - 20
          ),
          maxHeight: bounds.height - 16,
          fontSize: chat.settings.fontSize,
          fontFamily: fonts[chat.settings.font],
          '--tail-position': `${layout.tail}px`
        } as CSSProperties
      }
      onPointerEnter={() => chat.setBubbleHeld(true)}
      onPointerMove={() => chat.setBubbleHeld(true)}
      onPointerLeave={() => chat.setBubbleHeld(false)}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        className="bubble-close"
        aria-label="收起气泡"
        onClick={() => {
          chat.dismiss()
        }}
      >
        ×
      </button>
      <p
        ref={content}
        onScroll={() => {
          const node = content.current!
          follow.current = node.scrollHeight - node.scrollTop - node.clientHeight < 24
        }}
      >
        {chat.bubble}
      </p>
      <footer>
        {!chat.busy && !(chat.error && chat.canRetry) && (
          <button aria-label="继续聊" title="继续聊" onClick={() => chat.setOpen(true)}>
            ↩
          </button>
        )}
        {chat.busy && (
          <button aria-label="停止生成" title="停止生成" onClick={() => void chat.stop()}>
            ■
          </button>
        )}
        {chat.error && !chat.busy && chat.canRetry && (
          <button aria-label="重试" title="重试" onClick={() => void chat.send(true)}>
            ↻
          </button>
        )}
      </footer>
      <span className="visually-hidden" role="status">
        {chat.busy ? '波奇酱正在回答' : '波奇酱回答完成'}
      </span>
    </aside>
  )
}
