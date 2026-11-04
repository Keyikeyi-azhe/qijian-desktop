import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PetSprite } from './PetSprite'
import { atlas, clips, preloadPet } from './pet-assets'
import { IDLE_ACTIONS } from './pet-actions'
import {
  clampPosition,
  avoidCalendar,
  createPlan,
  INITIAL_STATE,
  petReducer,
  PET_SIZE,
  type Bounds,
  type Box,
  type Point
} from './pet-model'
import './pet.css'
import { useCompanion } from '../companion/useCompanion'
import { CompanionPanel } from '../companion/CompanionPanel'
import { CompanionBubble } from '../companion/CompanionBubble'

type DragSession = {
  id: number
  start: Point
  origin: Point
  moved: boolean
  target: HTMLButtonElement
}
export function VPetCompanion(): React.JSX.Element {
  const [surface, setSurface] = useState<HTMLElement>(document.body)
  useEffect(() => {
    const update = (): void => {
      const dialogs = document.querySelectorAll<HTMLElement>(
        '.calendar-dialog[open], .tool-dialog[open], .game-room[open]'
      )
      setSurface(dialogs.item(dialogs.length - 1) || document.body)
    }
    const observer = new MutationObserver(update)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['open']
    })
    update()
    return () => observer.disconnect()
  }, [])
  const [state, dispatch] = useReducer(petReducer, INITIAL_STATE)
  const step = state.steps[state.index]
  const phase = step.clip
  const playback = `${state.run}:${state.index}:${state.repeat}`
  const actionBounds = state.steps.reduce(
    (box, item) => {
      const next = clips[item.clip].bounds
      return [
        Math.min(box[0], next[0]),
        Math.min(box[1], next[1]),
        Math.max(box[2], next[2]),
        Math.max(box[3], next[3])
      ]
    },
    [...clips[phase].bounds]
  )
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 })
  const [bounds, setBounds] = useState<Bounds>({ width: 0, height: 0 })
  const [paused, setPaused] = useState(document.hidden)
  const [reducedMotion, setReducedMotion] = useState(
    matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  const [dragging, setDragging] = useState(false)
  const chat = useCompanion(paused || dragging || state.action === 'sleep')
  const [readyPlayback, setReadyPlayback] = useState('')
  const layer = useRef<HTMLDivElement>(null)
  const home = useRef<HTMLDivElement>(null)
  const petElement = useRef<HTMLDivElement>(null)
  const hitTarget = useRef<HTMLButtonElement>(null)
  const positionRef = useRef(position)
  const currentBox = useRef(clips.idle.bounds)
  const drag = useRef<DragSession | null>(null)
  const movement = useRef<{ key: string; origin: Point; elapsed: number } | null>(null)
  const manualUntil = useRef(0)
  const place = useCallback((point: Point): void => {
    if (!layer.current) return
    let next = clampPosition(
      point,
      { width: layer.current.clientWidth, height: layer.current.clientHeight },
      currentBox.current
    )
    const calendar =
      layer.current.parentElement === document.body
        ? document.querySelector('[data-calendar-protected]')?.getBoundingClientRect()
        : null
    if (calendar) {
      const container = layer.current.getBoundingClientRect()
      next = avoidCalendar(
        next,
        { width: container.width, height: container.height },
        currentBox.current,
        {
          left: calendar.left - container.left,
          right: calendar.right - container.left,
          top: calendar.top - container.top,
          bottom: calendar.bottom - container.top
        }
      )
    }
    positionRef.current = next
    // Resize and pointer events must update geometry before React's next commit.
    if (petElement.current)
      petElement.current.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`
    setPosition(next)
  }, [])
  const play = useCallback((id: string): void => {
    if (!layer.current) return
    const area = { width: layer.current.clientWidth, height: layer.current.clientHeight }
    dispatch({ type: 'play', action: id, steps: createPlan(id, positionRef.current, area, clips) })
  }, [])
  const returnHome = useCallback((): void => {
    if (layer.current && layer.current.parentElement !== document.body) {
      place({
        x: layer.current.clientWidth - PET_SIZE - 12,
        y: layer.current.clientHeight - PET_SIZE - 12
      })
      return
    }
    const anchor = home.current?.getBoundingClientRect()
    const container = layer.current?.getBoundingClientRect()
    if (!anchor || !container) return
    place({
      x: anchor.left - container.left + (anchor.width - PET_SIZE) / 2,
      y: anchor.top - container.top + (anchor.height - PET_SIZE) / 2
    })
  }, [place])
  const finishDrag = useCallback((): void => {
    const session = drag.current
    if (!session) return
    drag.current = null
    if (session.target.hasPointerCapture(session.id))
      session.target.releasePointerCapture(session.id)
    setDragging(false)
    if (session.moved) {
      play('drop')
    }
  }, [play])
  const openMenu = (): void => {
    finishDrag()
    chat.setSettingsOpen(false)
    chat.setOpen(true)
    if (state.action === 'sleep') play('wake')
  }
  useEffect(() => {
    if (
      !chat.motion.id ||
      paused ||
      reducedMotion ||
      dragging ||
      state.action === 'sleep' ||
      Date.now() < manualUntil.current
    )
      return
    play(chat.motion.action)
    // A new speech cue starts one animation; finishing it must not replay the cue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.motion.id])
  useLayoutEffect(() => {
    const box = [...clips[phase].bounds]
    if (step.peek === 'left') box[0] = box[2] - (56 * 320) / PET_SIZE
    if (step.peek === 'right') box[2] = box[0] + (56 * 320) / PET_SIZE
    currentBox.current = box
    place(positionRef.current)
  }, [phase, step.peek, place])
  useLayoutEffect(() => {
    const element = layer.current
    if (!element) return
    let previous = { width: element.clientWidth, height: element.clientHeight }
    const measure = (): void => {
      const next = { width: element.clientWidth, height: element.clientHeight }
      setBounds(next)
      place(positionRef.current)
      if (next.width !== previous.width || next.height !== previous.height) {
        finishDrag()
        play('idle')
      }
      previous = next
    }
    measure()
    returnHome()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [place, returnHome, play, finishDrag, surface])
  useEffect(() => {
    let active = true
    void preloadPet()
      .then(() => {
        if (active) {
          setReady(true)
        }
      })
      .catch(() => {
        if (active) setLoadError(true)
      })
    return () => {
      active = false
    }
  }, [])
  useEffect(() => {
    const visibility = (): void => {
      setPaused(document.hidden)
      if (document.hidden) {
        finishDrag()
      }
    }
    const blur = (): void => {
      finishDrag()
    }
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const motion = (): void => setReducedMotion(media.matches)
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('blur', blur)
    media.addEventListener('change', motion)
    const unsubscribe = window.companionWindow?.onVisibilityChange((visible) => {
      setPaused(!visible || document.hidden)
      if (!visible) {
        finishDrag()
      }
    })
    return () => {
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('blur', blur)
      media.removeEventListener('change', motion)
      unsubscribe?.()
    }
  }, [finishDrag])
  useEffect(() => {
    if (!ready || paused || reducedMotion || state.action !== 'idle' || dragging || chat.open)
      return
    const timer = setTimeout(
      () => play(IDLE_ACTIONS[Math.floor(Math.random() * IDLE_ACTIONS.length)]),
      chat.settings.activity === 'quiet'
        ? 18000 + Math.random() * 12000
        : chat.settings.activity === 'balanced'
          ? 8000 + Math.random() * 6000
          : 4000 + Math.random() * 4000
    )
    return () => clearTimeout(timer)
  }, [
    ready,
    paused,
    reducedMotion,
    state.action,
    dragging,
    chat.open,
    chat.settings.activity,
    play
  ])
  useEffect(() => {
    if (
      !chat.busy ||
      state.action !== 'idle' ||
      paused ||
      reducedMotion ||
      dragging ||
      Date.now() < manualUntil.current
    )
      return
    const timer = setTimeout(
      () => play(chat.motion.action === 'idle' ? 'research' : chat.motion.action),
      800
    )
    return () => clearTimeout(timer)
  }, [chat.busy, chat.motion.action, state.action, paused, reducedMotion, dragging, play])
  useEffect(() => {
    // Warm only the next two segments; a failed load is reported by the player if selected.
    for (const next of state.steps.slice(state.index + 1, state.index + 3))
      void atlas(next.clip).catch(() => {})
  }, [state.steps, state.index])
  const complete = useCallback((): void => {
    dispatch({ type: 'complete', run: state.run, index: state.index })
  }, [state.run, state.index])
  const spriteReady = useCallback((): void => setReadyPlayback(playback), [playback])
  const spriteError = useCallback((): void => {
    play('idle')
  }, [play])
  const frameBounds = useCallback((box: Box): void => {
    const target = hitTarget.current
    if (!target) return
    const scale = PET_SIZE / 320
    Object.assign(target.style, {
      left: `${box[0] * scale - 3}px`,
      top: `${box[1] * scale - 3}px`,
      width: `${(box[2] - box[0]) * scale + 6}px`,
      height: `${(box[3] - box[1]) * scale + 6}px`
    })
  }, [])
  useEffect(() => {
    if (!step.move || readyPlayback !== playback || paused || chat.open) return
    if (movement.current?.key !== playback)
      movement.current = { key: playback, origin: { ...positionRef.current }, elapsed: 0 }
    const progress = movement.current
    const path = step.move
    let request = 0
    let last: number | null = null
    const tick = (now: number): void => {
      if (last !== null) progress.elapsed += now - last
      last = now
      const ratio = reducedMotion ? 1 : Math.min(1, progress.elapsed / path.duration)
      place({
        x: progress.origin.x + (path.to.x - progress.origin.x) * ratio,
        y: progress.origin.y + (path.to.y - progress.origin.y) * ratio
      })
      if (ratio === 1) complete()
      else request = requestAnimationFrame(tick)
    }
    request = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(request)
  }, [step, playback, readyPlayback, paused, chat.open, reducedMotion, place, complete])
  const touch = (): void => {
    manualUntil.current = Date.now() + 8000
    play(state.action === 'sleep' ? 'wake' : 'touch')
  }
  const pointerDown = (event: React.PointerEvent<HTMLButtonElement>): void => {
    if (event.button !== 0 || drag.current) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      id: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin: { ...positionRef.current },
      moved: false,
      target: event.currentTarget
    }
  }
  const pointerMove = (event: React.PointerEvent<HTMLButtonElement>): void => {
    const session = drag.current
    if (!session || event.pointerId !== session.id) return
    const dx = event.clientX - session.start.x,
      dy = event.clientY - session.start.y
    if (!session.moved && Math.hypot(dx, dy) < 5) return
    if (!session.moved) {
      session.moved = true
      chat.dismiss()
      setDragging(true)
      play('lift')
    }
    place({ x: session.origin.x + dx, y: session.origin.y + dy })
  }
  const pointerUp = (event: React.PointerEvent<HTMLButtonElement>): void => {
    const session = drag.current
    if (!session || event.pointerId !== session.id) return
    const clicked = !session.moved
    finishDrag()
    if (clicked) {
      manualUntil.current = Date.now() + 8000
      if (state.action === 'sleep') {
        play('wake')
        return
      }
      const rect = petElement.current!.getBoundingClientRect()
      const x = ((event.clientX - rect.left) / PET_SIZE) * 500,
        y = ((event.clientY - rect.top) / PET_SIZE) * 500
      play(x >= 149 && x <= 205 && y >= 128 && y <= 187 ? 'pinch' : y >= 206 ? 'body' : 'touch')
    }
  }
  const keyboard = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    event.stopPropagation()
    const directions: Record<string, Point> = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 }
    }
    const direction = directions[event.key]
    if (direction) {
      event.preventDefault()
      play('idle')
      const distance = event.shiftKey ? 40 : 16
      place({
        x: positionRef.current.x + direction.x * distance,
        y: positionRef.current.y + direction.y * distance
      })
    } else if (event.key === 'Home') {
      event.preventDefault()
      play('idle')
      returnHome()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      finishDrag()
      play('idle')
    } else if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
      event.preventDefault()
      openMenu()
    }
  }
  return (
    <>
      <div className="scene-pet-home" ref={home}>
        {!ready && (
          <p role="status">
            {loadError ? '桌宠素材加载失败，请重新打开应用。' : '波奇酱正在过来…'}
          </p>
        )}
      </div>
      {createPortal(
        <div
          className="pet-layer"
          ref={layer}
          data-testid="pet-layer"
          data-on-page={surface !== document.body}
        >
          {ready && bounds.width > 0 && (
            <>
              <div
                className={`floating-pet${dragging ? ' is-dragging' : ''}`}
                ref={petElement}
                style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
                data-phase={phase}
                data-peek={step.peek}
                data-action={state.action}
                data-run={state.run}
                data-step={state.index}
                data-testid="floating-pet"
              >
                <PetSprite
                  phase={phase}
                  playback={playback}
                  loop={!!step.move || step.repeat === Infinity}
                  paused={paused}
                  reducedMotion={reducedMotion}
                  onComplete={complete}
                  onReady={spriteReady}
                  onError={spriteError}
                  onFrame={frameBounds}
                />
                <button
                  className="pet-hit-target"
                  ref={hitTarget}
                  data-testid="pet-hit-target"
                  aria-label="波奇酱桌宠，拖动可移动，右键聊天或选择动作"
                  aria-describedby="pet-keyboard-help"
                  onPointerDown={pointerDown}
                  onPointerMove={pointerMove}
                  onPointerUp={pointerUp}
                  onPointerCancel={() => finishDrag()}
                  onLostPointerCapture={() => finishDrag()}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    openMenu()
                  }}
                  onClick={(event) => {
                    if (event.detail === 0) touch()
                  }}
                  onKeyDown={keyboard}
                  draggable={false}
                />
              </div>
            </>
          )}
          {chat.open && bounds.width > 0 && (
            <CompanionPanel
              chat={chat}
              position={position}
              bounds={bounds}
              onAction={(id) => {
                manualUntil.current = Date.now() + 12000
                chat.setOpen(false)
                play(id)
              }}
              onClose={() => {
                chat.setOpen(false)
                hitTarget.current?.focus({ preventScroll: true })
              }}
            />
          )}
          {chat.bubble && !chat.open && (
            <CompanionBubble
              chat={chat}
              bounds={bounds}
              pet={{
                left: position.x + (actionBounds[0] * PET_SIZE) / 320,
                top: position.y + (actionBounds[1] * PET_SIZE) / 320,
                right: position.x + (actionBounds[2] * PET_SIZE) / 320,
                bottom: position.y + (actionBounds[3] * PET_SIZE) / 320
              }}
            />
          )}
          <span className="visually-hidden" id="pet-keyboard-help">
            方向键移动，Shift 加方向键加速，Home 回到书桌左下角，Enter 或空格摸头，Shift 加 F10
            打开动作菜单，Escape 停止动作。
          </span>
        </div>,
        surface
      )}
    </>
  )
}
