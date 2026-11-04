import { registerLiveData } from '../companion/live-data'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  GameControllerIcon,
  PauseIcon,
  PlayIcon,
  ArrowCounterClockwiseIcon
} from '@phosphor-icons/react'
import { games, type GameId } from './game-catalog'
import './games.css'
import { companionEvent } from '../companion/events'

export function GameRoom({
  theme,
  onClose
}: {
  theme: 'day' | 'night'
  onClose: () => void
}): React.JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const confirmation = useRef<HTMLDialogElement>(null)
  const [selected, setSelected] = useState<GameId | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [paused, setPaused] = useState(false)
  const [result, setResult] = useState<'won' | 'lost' | null>(null)
  const [restart, setRestart] = useState(0)
  const [confirm, setConfirm] = useState<'leave' | 'close' | 'restart' | null>(null)
  const [telemetry, setTelemetry] = useState<Record<string, unknown> | null>(null)
  useEffect(
    () =>
      registerLiveData('game', () =>
        selected
          ? { selected, state, paused, result, telemetry }
          : { selected: null, state: 'selection' }
      ),
    [selected, state, paused, result, telemetry]
  )
  const game = games.find((item) => item.id === selected)

  useEffect(() => {
    if (confirm) confirmation.current?.showModal()
  }, [confirm])

  useEffect(() => {
    const element = dialog.current!
    const previous = document.activeElement
    element.showModal()
    return () => {
      element.close()
      if (previous instanceof HTMLElement || previous instanceof SVGElement) previous.focus()
    }
  }, [])

  useEffect(() => {
    if (!selected) return
    const origin = `qijian-game://${selected}`
    const receive = (event: MessageEvent): void => {
      if (event.source !== frame.current?.contentWindow || event.origin !== origin) return
      if (event.data?.type === 'qijian:telemetry') {
        const raw = event.data.value
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
          const next: Record<string, unknown> = {}
          for (const key of [
            'score',
            'best',
            'count',
            'mergeCount',
            'level',
            'health',
            'selectedElement',
            'brushSize'
          ]) {
            const value = raw[key]
            if (
              (typeof value === 'number' && Number.isFinite(value)) ||
              (typeof value === 'string' && value.length < 80)
            )
              next[key] = value
          }
          setTelemetry(next)
        }
      } else if (event.data?.type === 'qijian:ready') {
        setState('ready')
        frame.current?.focus()
      } else if (event.data?.type === 'qijian:error') setState('error')
      else if (event.data?.type === 'qijian:ended' && ['won', 'lost'].includes(event.data.result)) {
        setResult(event.data.result)
        companionEvent({ kind: 'game', detail: `游戏结束：${event.data.result}` })
        setState('ready')
        setPaused(true)
        setConfirm(null)
        frame.current?.contentWindow?.postMessage({ type: 'qijian:pause', value: true }, origin)
      } else if (event.data?.type === 'qijian:paused') setPaused(Boolean(event.data.value))
    }
    window.addEventListener('message', receive)
    const timeout = window.setTimeout(() => setState((s) => (s === 'loading' ? 'error' : s)), 30000)
    return () => {
      window.removeEventListener('message', receive)
      clearTimeout(timeout)
    }
  }, [selected, restart])

  const command = (value: boolean): void => {
    frame.current?.contentWindow?.postMessage(
      { type: 'qijian:pause', value },
      `qijian-game://${selected}`
    )
    setPaused(value)
    if (value) companionEvent({ kind: 'game', detail: '暂停游戏' })
    if (!value) frame.current?.focus()
  }
  const choose = (id: GameId): void => {
    setTelemetry(null)
    companionEvent({
      kind: 'scene',
      detail: `游戏 game：${games.find((item) => item.id === id)?.title || id}`
    })
    setState('loading')
    setPaused(false)
    setSelected(id)
    setResult(null)
  }
  const request = (action: 'leave' | 'close' | 'restart'): void => {
    if (!selected || state !== 'ready' || result) {
      setResult(null)
      setPaused(false)
      if (action === 'close') onClose()
      else if (action === 'restart') {
        setState('loading')
        setTelemetry(null)
        setRestart((n) => n + 1)
      } else setSelected(null)
      return
    }
    command(true)
    setConfirm(action)
  }
  const proceed = (): void => {
    if (confirm === 'close') onClose()
    else if (confirm === 'restart') {
      setState('loading')
      setPaused(false)
      setTelemetry(null)
      setRestart((n) => n + 1)
    } else setSelected(null)
    setConfirm(null)
  }

  return createPortal(
    <dialog
      ref={dialog}
      className="game-room"
      data-theme={theme}
      aria-labelledby="game-room-title"
      onCancel={(e) => {
        e.preventDefault()
        if (!confirm) request(selected ? 'leave' : 'close')
      }}
    >
      <header className="game-room-header">
        <button className="game-room-back" onClick={() => request(selected ? 'leave' : 'close')}>
          <ArrowLeftIcon size={18} aria-hidden="true" />
          {selected ? '游戏选择' : '回到书桌'}
        </button>
        <h1 id="game-room-title">{game?.title ?? '玩一小会儿'}</h1>
        {selected ? (
          <div className="game-room-actions">
            <button disabled={state !== 'ready' || !!result} onClick={() => command(!paused)}>
              {paused ? (
                <PlayIcon size={17} aria-hidden="true" />
              ) : (
                <PauseIcon size={17} aria-hidden="true" />
              )}
              {paused ? '继续' : '暂停'}
            </button>
            <button onClick={() => request('restart')}>
              <ArrowCounterClockwiseIcon size={17} aria-hidden="true" />
              重开
            </button>
            <button onClick={() => request('close')}>回到书桌</button>
          </div>
        ) : (
          <span className="game-room-caption">
            <GameControllerIcon size={20} aria-hidden="true" />
            书桌里的游戏时光
          </span>
        )}
      </header>
      {!game ? (
        <div className="game-room-library">
          <div className="game-room-intro">
            <p>给自己放个小假</p>
            <span>闯一关、堆一篮水果，或者什么也不想，只玩沙。</span>
          </div>
          <div className="game-room-grid">
            {games.map((item, index) => (
              <button
                key={item.id}
                className={`game-room-card game-room-card-${item.id}`}
                onClick={() => choose(item.id)}
                aria-label={`开始${item.title}`}
              >
                <div className="game-room-cover">
                  <img src={`./games/${item.id}/cover.webp`} alt="" />
                  <span>{String(index + 1).padStart(2, '0')}</span>
                </div>
                <div className="game-room-card-copy">
                  <span className="game-room-category">{item.category}</span>
                  <h2>
                    {item.title}
                    <ArrowRightIcon size={20} aria-hidden="true" />
                  </h2>
                  <p>{item.description}</p>
                </div>
              </button>
            ))}
          </div>
          <p className="game-room-footnote">就在这里玩。结束后，回到你的书桌。</p>
        </div>
      ) : (
        <>
          <div className="game-room-controls">{game.controls}</div>
          <div className="game-room-player" aria-busy={state === 'loading'}>
            <iframe
              key={`${selected}-${restart}`}
              ref={frame}
              title={game.title}
              src={`qijian-game://${selected}/`}
              sandbox="allow-scripts allow-same-origin"
              allow="autoplay"
              referrerPolicy="no-referrer"
            />
            {state !== 'ready' && (
              <div className="game-room-status" role={state === 'error' ? 'alert' : 'status'}>
                <GameControllerIcon size={32} aria-hidden="true" />
                <p>{state === 'loading' ? '正在打开游戏…' : '游戏没能正常加载'}</p>
                {state === 'error' && (
                  <button
                    onClick={() => {
                      setState('loading')
                      setTelemetry(null)
                      setRestart((n) => n + 1)
                    }}
                  >
                    重新加载
                  </button>
                )}
              </div>
            )}
            {result && (
              <div className="game-room-result" role="region" aria-label="本局结束">
                <div>
                  <p>休息一下，下一局再出发</p>
                  <h2>
                    {result === 'won'
                      ? '闯关成功！'
                      : selected === 'fruitbasket'
                        ? '篮子装满啦'
                        : '本局结束'}
                  </h2>
                  <div>
                    <button autoFocus onClick={() => request('restart')}>
                      <ArrowCounterClockwiseIcon size={18} />
                      再来一局
                    </button>
                    <button onClick={() => request('leave')}>退出到游戏列表</button>
                    <button onClick={() => request('close')}>回到书桌</button>
                  </div>
                </div>
              </div>
            )}
            {state === 'ready' && paused && !confirm && !result && (
              <div className="game-room-pause">
                <button onClick={() => command(false)}>
                  <PlayIcon size={24} aria-hidden="true" />
                  继续游戏
                </button>
              </div>
            )}
          </div>
          <footer className="game-room-credit">
            {game.original}
            <details>
              <summary>作者与许可</summary>
              <p>{game.credit}</p>
              <p>完整许可、原始来源与修改记录随应用保存在游戏资源内。</p>
            </details>
          </footer>
        </>
      )}
      {confirm && (
        <dialog
          ref={confirmation}
          className="game-room-confirm"
          aria-labelledby="game-confirm-title"
          onCancel={(event) => {
            event.preventDefault()
            setConfirm(null)
            command(false)
          }}
        >
          <div>
            <h2 id="game-confirm-title">
              {confirm === 'restart' ? '重新开始这一局？' : '先玩到这里？'}
            </h2>
            <p>当前画面将结束。已记录的最高分和解锁进度会保留。</p>
            <div>
              <button
                autoFocus
                onClick={() => {
                  setConfirm(null)
                  command(false)
                }}
              >
                继续玩
              </button>
              <button onClick={proceed}>{confirm === 'restart' ? '重新开始' : '结束本局'}</button>
            </div>
          </div>
        </dialog>
      )}
    </dialog>,
    document.body
  )
}
