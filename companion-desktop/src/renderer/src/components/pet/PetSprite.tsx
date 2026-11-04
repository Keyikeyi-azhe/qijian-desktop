import { useEffect, useRef } from 'react'
import { atlas, clips } from './pet-assets'
import type { Box } from './pet-model'
type Props = {
  phase: string
  playback: string
  loop: boolean
  paused: boolean
  reducedMotion: boolean
  onComplete: () => void
  onReady: () => void
  onError: () => void
  onFrame: (box: Box) => void
}
export function PetSprite({
  phase,
  playback,
  loop,
  paused,
  reducedMotion,
  onComplete,
  onReady,
  onError,
  onFrame
}: Props): React.JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null)
  const pausedRef = useRef(paused)
  const lastTime = useRef<number | null>(null)
  useEffect(() => {
    pausedRef.current = paused
    lastTime.current = null
  }, [paused])
  useEffect(() => {
    let stopped = false
    let request = 0
    let elapsed = 0
    let drawn = -1
    lastTime.current = null
    const clip = clips[phase]
    const total = clip.durations.reduce((a, b) => a + b, 0)
    void atlas(phase)
      .then((image) => {
        if (stopped) return
        const element = canvas.current
        const context = element?.getContext('2d')
        if (!element || !context) return
        const draw = (frame: number): void => {
          if (drawn === frame) return
          drawn = frame
          context.clearRect(0, 0, clip.size, clip.size)
          context.drawImage(
            image,
            (frame % clip.columns) * clip.size,
            Math.floor(frame / clip.columns) * clip.size,
            clip.size,
            clip.size,
            0,
            0,
            clip.size,
            clip.size
          )
          element.dataset.frame = String(frame)
          element.dataset.clip = phase
          onFrame(clip.hitboxes[frame])
        }
        draw(0)
        onReady()
        const tick = (now: number): void => {
          if (stopped) return
          if (!pausedRef.current && lastTime.current !== null) elapsed += now - lastTime.current
          lastTime.current = now
          if (elapsed >= total && !loop) {
            onComplete()
            return
          }
          let time = elapsed % total
          let frame = 0
          while (frame < clip.durations.length - 1 && time >= clip.durations[frame])
            time -= clip.durations[frame++]
          draw(reducedMotion ? 0 : frame)
          request = requestAnimationFrame(tick)
        }
        request = requestAnimationFrame(tick)
      })
      .catch(() => {
        if (!stopped) onError()
      })
    return () => {
      stopped = true
      cancelAnimationFrame(request)
    }
  }, [phase, playback, loop, reducedMotion, onComplete, onReady, onError, onFrame])
  return (
    <canvas
      ref={canvas}
      width={320}
      height={320}
      aria-hidden="true"
      data-motion={paused ? 'paused' : reducedMotion ? 'reduced' : 'playing'}
    />
  )
}
