import { runLocalTool } from './local-tools'
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import {
  COMPANION_DEFAULTS,
  type CaptureArea,
  type ChatMessage,
  type CompanionSettings
} from '../../../../shared/companion'
import {
  companionContext,
  companionScene,
  companionRevision,
  eventReply,
  type CompanionEvent
} from './events'
type Setter<T> = Dispatch<SetStateAction<T>>
export type CompanionController = {
  open: boolean
  setOpen: Setter<boolean>
  settingsOpen: boolean
  setSettingsOpen: Setter<boolean>
  settings: CompanionSettings
  setSettings: Setter<CompanionSettings>
  messages: ChatMessage[]
  draft: string
  setDraft: Setter<string>
  busy: boolean
  loaded: boolean
  error: string
  setError: Setter<string>
  bubble: string
  setBubble: Setter<string>
  setBubbleHeld: Setter<boolean>
  dismiss: () => void
  motion: { id: number; action: string }
  send: (retry?: boolean, look?: boolean) => Promise<void>
  stop: () => Promise<void>
  clear: () => Promise<void>
  canRetry: boolean
}
function typing(): boolean {
  const e = document.activeElement
  return (
    e instanceof HTMLElement &&
    (e.isContentEditable ||
      e.tagName === 'TEXTAREA' ||
      (e instanceof HTMLInputElement &&
        !['checkbox', 'radio', 'button', 'submit', 'range', 'color'].includes(e.type)))
  )
}
function captureArea(automatic = false): CaptureArea | undefined {
  if (
    document.querySelector('.companion-settings, [role="alertdialog"], .game-room-confirm[open]') ||
    document.hidden
  )
    return
  const dialogs = document.querySelectorAll<HTMLElement>(
    '.calendar-dialog[open], .tool-dialog[open], .game-room[open]'
  )
  const dialog = dialogs.item(dialogs.length - 1)
  if (automatic && !dialog) return
  const element =
    dialog?.querySelector<HTMLElement>('.drawing-canvas, .game-room-player, .tool-body') ||
    dialog ||
    document.documentElement
  const box = element.getBoundingClientRect(),
    x = Math.max(0, box.x),
    y = Math.max(0, box.y)
  const rect = {
    x,
    y,
    width: Math.min(innerWidth, box.right) - x,
    height: Math.min(innerHeight, box.bottom) - y
  }
  if (rect.width < 1 || rect.height < 1) return
  const masks = Array.from(
    document.querySelectorAll<HTMLElement>('.floating-pet, .companion-panel, .companion-bubble')
  )
    .map((node) => {
      const r = node.getBoundingClientRect()
      return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: r.width, height: r.height }
    })
    .slice(0, 12)
  return {
    rect,
    masks,
    scene: companionScene(),
    revision: companionScene().includes('drawing') ? companionRevision() || undefined : undefined
  }
}
export function useCompanion(quiet: boolean): CompanionController {
  const [open, setOpen] = useState(false),
    [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState(COMPANION_DEFAULTS),
    [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState(''),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(window.companion ? '' : '请在栖间桌面程序中使用聊天。')
  const [bubble, setBubble] = useState(''),
    [bubbleHeld, setBubbleHeld] = useState(false)
  const [motion, setMotion] = useState({ id: 0, action: 'idle' })
  const animate = (action: string): void => setMotion((old) => ({ id: old.id + 1, action }))
  const current = useRef<{
    id: string
    observe: boolean
    text: string
    dismissed?: boolean
  } | null>(null)
  const [lastPrompt, setLastPrompt] = useState('')
  const lastSpeech = useRef(0),
    lastInput = useRef(0),
    seen = useRef(new Map<string, number>())
  const lastObservationAttempt = useRef(0),
    observationRetryAt = useRef(0),
    dismissedAt = useRef(0)
  const pointerActive = useRef(false),
    lastInteraction = useRef(0)
  const dismiss = (): void => {
    setBubble('')
    setBubbleHeld(false)
    dismissedAt.current = Date.now()
    if (current.current?.observe) {
      void window.companion?.cancel(current.current.id)
      current.current = null
    } else if (current.current) current.current.dismissed = true
  }
  const liveState = useRef({ quiet, open, settings, loaded, bubbleHeld })
  useEffect(() => {
    liveState.current = { quiet, open, settings, loaded, bubbleHeld }
  }, [quiet, open, settings, loaded, bubbleHeld])
  useEffect(() => {
    // Keep the answer being read even if a background observation is already in flight.
    if (bubbleHeld && current.current?.observe) {
      void window.companion?.cancel(current.current.id)
      current.current = null
    }
  }, [bubbleHeld])
  useEffect(() => {
    if (open && current.current?.observe) {
      void window.companion?.cancel(current.current.id)
      current.current = null
    }
  }, [open])
  useEffect(() => {
    const api = window.companion
    if (!api) return
    const unsubscribeTools = api.onToolRequest((request) => {
      void runLocalTool(request.name, request.args)
        .then((result) => api.toolResult({ id: request.id, result }))
        .catch(() => api.toolResult({ id: request.id, result: { error: '本地查询失败。' } }))
    })
    let live = true
    void api
      .load()
      .then((s) => {
        if (live) {
          setMessages(s.messages)
          setSettings({ ...COMPANION_DEFAULTS, ...s.settings })
          setLoaded(true)
        }
      })
      .catch(() => {
        if (live) setError('陪伴记录读取失败，原记录已保留，请重启后重试。')
      })
    const unsubscribe = api.onUpdate((update) => {
      const request = current.current
      if (!request || update.id !== request.id) return
      if (update.action && update.action !== 'idle') animate(update.action)
      if (update.delta) {
        request.text += update.delta
        if (!request.dismissed) setBubble(request.text)
        if (!request.observe)
          setMessages((old) =>
            old.map((m, i) => (i === old.length - 1 ? { ...m, content: request.text } : m))
          )
      }
      if (update.done) {
        current.current = null
        setBusy(false)
        if (request.observe) {
          if (update.error) {
            setError(`窗口识图：${update.error}`)
            observationRetryAt.current = Date.now() + 30000
          } else if (request.text) setError('')
          if (request.text) lastSpeech.current = Date.now()
        } else {
          setError(update.error || '')
          if (update.error && !request.dismissed)
            setBubble(`${request.text}${request.text ? '\n' : ''}${update.error}`)
          setMessages((old) =>
            old.map((m, i) =>
              i === old.length - 1
                ? { ...m, status: update.stopped ? 'stopped' : update.error ? 'error' : 'complete' }
                : m
            )
          )
        }
      }
    })
    const input = (): void => {
      lastInput.current = Date.now()
    }
    document.addEventListener('input', input, true)
    const down = (): void => {
      pointerActive.current = true
      lastInteraction.current = Date.now()
    }
    const up = (): void => {
      pointerActive.current = false
      lastInteraction.current = Date.now()
    }
    const blur = (): void => {
      pointerActive.current = false
    }
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('pointerup', up, true)
    document.addEventListener('pointercancel', up, true)
    window.addEventListener('blur', blur)
    return () => {
      live = false
      unsubscribe()
      unsubscribeTools()
      document.removeEventListener('input', input, true)
      document.removeEventListener('pointerdown', down, true)
      document.removeEventListener('pointerup', up, true)
      document.removeEventListener('pointercancel', up, true)
      window.removeEventListener('blur', blur)
      if (current.current) void api.cancel(current.current.id)
    }
  }, [])
  useEffect(() => {
    let pending: { event: CompanionEvent; at: number } | null = null
    let variation = 0
    const speak = (event: CompanionEvent): void => {
      const state = liveState.current,
        now = Date.now(),
        reply = eventReply(event, state.settings.language, variation)
      const cooldown =
        state.settings.activity === 'quiet'
          ? 12000
          : state.settings.activity === 'balanced'
            ? 5000
            : 3000
      if (state.settings.hasKey && now >= observationRetryAt.current && event.kind !== 'scene')
        return
      if (
        !reply ||
        !state.loaded ||
        !state.settings.proactive ||
        state.quiet ||
        state.open ||
        state.bubbleHeld ||
        current.current ||
        document.hidden ||
        pointerActive.current ||
        now - dismissedAt.current < 3000 ||
        now - lastInput.current < 1000 ||
        now - lastSpeech.current < cooldown ||
        now - (seen.current.get(reply) || 0) < 12000
      )
        return
      lastSpeech.current = now
      seen.current.set(reply, now)
      variation++
      if (seen.current.size > 40) seen.current.clear()
      setBubble(reply)
      animate(
        event.kind === 'review'
          ? 'study'
          : event.kind === 'drawing'
            ? 'paint'
            : event.kind === 'game'
              ? 'game'
              : event.kind === 'todo'
                ? 'happy'
                : 'cute'
      )
      pending = null
    }
    const receive = (raw: Event): void => {
      const event = (raw as CustomEvent<CompanionEvent>).detail
      if (event.kind === 'scene') {
        pending = null
        setBubble('')
        if (current.current?.observe) {
          void window.companion?.cancel(current.current.id)
          current.current = null
          setBusy(false)
        }
      }
      pending = { event, at: Date.now() }
      speak(event)
    }
    const timer = setInterval(() => {
      if (pending && pending.at >= dismissedAt.current && Date.now() - pending.at < 15000)
        speak(pending.event)
      else pending = null
    }, 750)
    window.addEventListener('qijian:companion-event', receive)
    return () => {
      clearInterval(timer)
      window.removeEventListener('qijian:companion-event', receive)
    }
  }, [])
  useEffect(() => {
    if (!bubble || busy || bubbleHeld) return
    const timer = setTimeout(
      () => setBubble(''),
      Math.max(5000, Math.min(10000, bubble.length * 120))
    )
    return () => clearTimeout(timer)
  }, [bubble, busy, bubbleHeld])
  useEffect(() => {
    if (!settings.proactive || !settings.hasKey || !loaded) return
    observationRetryAt.current = 0
    const timer = setInterval(() => {
      const state = liveState.current
      if (
        state.quiet ||
        state.open ||
        state.bubbleHeld ||
        current.current ||
        pointerActive.current ||
        (typing() && Date.now() - lastInput.current < 1500) ||
        document.hidden ||
        Date.now() - lastInput.current < 1000 ||
        Date.now() - lastInteraction.current < 650 ||
        Date.now() - dismissedAt.current < 3000 ||
        Date.now() < observationRetryAt.current ||
        Date.now() - lastObservationAttempt.current < state.settings.visionInterval * 1000 ||
        Date.now() - lastSpeech.current < 3000
      )
        return
      const capture = captureArea(true)
      if (!capture) return
      const id = crypto.randomUUID()
      lastObservationAttempt.current = Date.now()
      current.current = { id, observe: true, text: '' }
      void window
        .companion!.send({
          id,
          mode: 'observe',
          text: '看看我正在做的事，接着我们刚才的话随口聊一句。可以吐槽、惊讶、共鸣或认真回应，不必讲解画面或安排下一步；没有新意就安静。',
          context: companionContext(),
          capture
        })
        .catch((cause) => {
          if (current.current?.id === id) {
            current.current = null
            observationRetryAt.current = Date.now() + 30000
            setError(cause instanceof Error ? cause.message : '窗口识图失败。')
          }
        })
    }, 750)
    return () => clearInterval(timer)
  }, [settings.vision, settings.proactive, settings.hasKey, settings.visionInterval, loaded])
  const send = async (retry = false, look = false): Promise<void> => {
    const text = (retry ? lastPrompt : draft).trim() || (look ? '看看当前画面，陪我聊聊。' : '')
    if (!text || (current.current && !current.current.observe) || !loaded) return
    if (!settings.hasKey) {
      setSettingsOpen(true)
      setError('先填好 API Key，我们就可以聊天了。')
      return
    }
    // A conversation inside a tool needs its current content, including ordinary Send.
    const capture = settings.vision ? captureArea(!look) : undefined
    if (look && (!settings.vision || !capture)) {
      setError('请在设置中开启窗口识图，再返回聊天。')
      return
    }
    if (current.current?.observe) await window.companion!.cancel(current.current.id)
    const id = crypto.randomUUID()
    current.current = { id, observe: false, text: '' }
    setLastPrompt(text)
    setBusy(true)
    setError('')
    setDraft('')
    setOpen(false)
    setBubbleHeld(false)
    setBubble('让我想一想……')
    lastSpeech.current = Date.now()
    animate('research')
    setMessages((old) => [
      ...(retry ? old.slice(0, -2) : old),
      { role: 'user', content: text },
      { role: 'assistant', content: '' }
    ])
    try {
      await window.companion!.send({ id, text, context: companionContext(), retry, capture, look })
    } catch (cause) {
      if (current.current?.id !== id) return
      current.current = null
      setBusy(false)
      const message =
        cause instanceof Error
          ? cause.message.replace(/^Error invoking remote method '[^']+': Error: /, '')
          : '发送失败，请重试。'
      setError(message)
      setBubble(message)
      setMessages((old) =>
        old.map((m, i) => (i === old.length - 1 ? { ...m, status: 'error' } : m))
      )
    }
  }
  const stop = async (): Promise<void> => {
    try {
      if (current.current) await window.companion?.cancel(current.current.id)
    } catch {
      setError('停止失败，请稍后重试。')
    }
  }
  const clear = async (): Promise<void> => {
    if (busy) return
    try {
      await window.companion!.clear()
      setMessages([])
      setError('')
      setLastPrompt('')
      setBubble('')
    } catch {
      setError('清空失败，原对话仍保留。')
    }
  }
  return {
    open,
    setOpen,
    settingsOpen,
    setSettingsOpen,
    settings,
    setSettings,
    messages,
    draft,
    setDraft,
    busy,
    loaded,
    error,
    setError,
    bubble: quiet || open ? '' : bubble,
    setBubble,
    setBubbleHeld,
    dismiss,
    motion,
    send,
    stop,
    clear,
    canRetry: !!lastPrompt
  }
}
