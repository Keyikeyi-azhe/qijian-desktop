import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CaretRightIcon } from '@phosphor-icons/react'
import { ACTION_GROUPS } from './pet-actions'
import type { Bounds, Point } from './pet-model'
type Props = {
  point: Point
  bounds: Bounds
  onSelect: (action: string) => void
  onClose: () => void
  onChat: () => void
}
export function PetActionMenu({
  point,
  bounds,
  onSelect,
  onClose,
  onChat
}: Props): React.JSX.Element {
  const [category, setCategory] = useState<number | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const menuWidth = 168
  const subWidth = 190
  const left = Math.max(8, Math.min(point.x, bounds.width - menuWidth - 8))
  const top = Math.max(8, Math.min(point.y, bounds.height - 320))
  const opensLeft = left + menuWidth + subWidth + 4 > bounds.width - 8
  useLayoutEffect(() => {
    root.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }, [])
  useEffect(() => {
    const outside = (event: PointerEvent): void => {
      if (!root.current?.contains(event.target as Node)) onClose()
    }
    const blur = (): void => onClose()
    document.addEventListener('pointerdown', outside, true)
    window.addEventListener('blur', blur)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      window.removeEventListener('blur', blur)
    }
  }, [onClose])
  const keyboard = (event: React.KeyboardEvent): void => {
    const button = event.target as HTMLButtonElement
    const list = button.closest('[role=menu]')
    const buttons = Array.from(list?.querySelectorAll<HTMLButtonElement>(':scope > button') ?? [])
    const index = buttons.indexOf(button)
    if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault()
      onClose()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      buttons[
        (index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length
      ]?.focus()
    } else if (event.key === 'ArrowRight' && button.dataset.category) {
      event.preventDefault()
      setCategory(Number(button.dataset.category))
      requestAnimationFrame(() =>
        root.current?.querySelector<HTMLButtonElement>('.pet-submenu button')?.focus()
      )
    } else if (event.key === 'ArrowLeft' && list?.classList.contains('pet-submenu')) {
      event.preventDefault()
      root.current?.querySelector<HTMLButtonElement>(`[data-category="${category}"]`)?.focus()
      setCategory(null)
    }
  }
  return (
    <div
      className="pet-menu-root"
      ref={root}
      style={{ left, top }}
      onKeyDown={keyboard}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="pet-action-menu" role="menu" aria-label="桌宠动作分类">
        <button role="menuitem" onPointerEnter={() => setCategory(null)} onClick={onChat}>
          和波奇酱聊聊
        </button>
        {ACTION_GROUPS.map((group, index) => (
          <button
            key={group.label}
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={category === index}
            data-category={index}
            onPointerEnter={() => setCategory(index)}
            onClick={() => setCategory(index)}
            className={category === index ? 'is-selected' : ''}
          >
            {group.label}
            <CaretRightIcon size={13} />
          </button>
        ))}
      </div>
      {category !== null && (
        <div
          className="pet-action-menu pet-submenu"
          role="menu"
          aria-label={ACTION_GROUPS[category].label}
          style={{ left: opensLeft ? -subWidth : menuWidth, maxHeight: bounds.height - top - 8 }}
        >
          {ACTION_GROUPS[category].actions.map((action) => (
            <button
              key={action.id}
              role="menuitem"
              data-action={action.id}
              onClick={() => onSelect(action.id)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
