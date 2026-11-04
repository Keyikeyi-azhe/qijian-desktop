import { ACTIONS } from './pet-actions'
export const PET_SIZE = 220
export const PET_MARGIN = 8
export type Point = { x: number; y: number }
export type Bounds = { width: number; height: number }
export type Box = number[]
export type ClipInfo = { durations: number[]; bounds: Box }
export type Step = {
  clip: string
  repeat?: number
  move?: { to: Point; duration: number }
  peek?: 'left' | 'right'
}
export type PetState = { action: string; steps: Step[]; index: number; repeat: number; run: number }
export const INITIAL_STATE: PetState = {
  action: 'idle',
  steps: [{ clip: 'idle', repeat: Infinity }],
  index: 0,
  repeat: 0,
  run: 0
}
export function clampPosition(point: Point, bounds: Bounds, box: Box = [0, 0, 320, 320]): Point {
  const scale = PET_SIZE / 320
  return {
    x: Math.max(
      PET_MARGIN - box[0] * scale,
      Math.min(point.x, bounds.width - PET_MARGIN - box[2] * scale)
    ),
    y: Math.max(
      PET_MARGIN - box[1] * scale,
      Math.min(point.y, bounds.height - PET_MARGIN - box[3] * scale)
    )
  }
}
export function avoidCalendar(
  point: Point,
  bounds: Bounds,
  box: Box,
  rect: { left: number; top: number; right: number; bottom: number }
): Point {
  const scale = PET_SIZE / 320
  const overlaps = (p: Point): boolean =>
    p.x + box[2] * scale > rect.left &&
    p.x + box[0] * scale < rect.right &&
    p.y + box[3] * scale > rect.top &&
    p.y + box[1] * scale < rect.bottom
  if (!overlaps(point)) return point
  const candidates = [
    { x: rect.left - box[2] * scale - 8, y: point.y },
    { x: rect.right - box[0] * scale + 8, y: point.y },
    { x: point.x, y: rect.top - box[3] * scale - 8 },
    { x: point.x, y: rect.bottom - box[1] * scale + 8 }
  ]
    .map((p) => clampPosition(p, bounds, box))
    .filter((p) => !overlaps(p))
  candidates.sort(
    (a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y)
  )
  return candidates[0] || point
}
export function petReducer(
  state: PetState,
  event:
    | { type: 'play'; action: string; steps: Step[] }
    | { type: 'complete'; run: number; index: number }
): PetState {
  if (event.type === 'play')
    return { action: event.action, steps: event.steps, index: 0, repeat: 0, run: state.run + 1 }
  if (event.run !== state.run || event.index !== state.index) return state
  const step = state.steps[state.index]
  if (state.repeat + 1 < (step.repeat ?? 1)) return { ...state, repeat: state.repeat + 1 }
  if (state.index + 1 < state.steps.length) return { ...state, index: state.index + 1, repeat: 0 }
  return { ...INITIAL_STATE, run: state.run + 1 }
}
export function createPlan(
  id: string,
  origin: Point,
  bounds: Bounds,
  clips: Record<string, ClipInfo>
): Step[] {
  if (id === 'lift')
    return [{ clip: 'lift-start' }, { clip: 'drag' }, { clip: 'lift-loop', repeat: Infinity }]
  if (id === 'drop') return [{ clip: 'drop' }]
  if (id === 'idle') return [{ clip: 'idle', repeat: Infinity }]
  if (id === 'sleep') return [{ clip: 'sleep-start' }, { clip: 'sleep-loop', repeat: Infinity }]
  const action = ACTIONS[id]
  if (!action) return [{ clip: 'idle', repeat: Infinity }]
  if (!action.movement)
    return action.clips.map((clip) => ({
      clip,
      repeat: clip.endsWith('-loop') || action.clips.length === 1 ? (action.loops ?? 1) : 1
    }))
  const union = (names: string[]): Box => [
    Math.min(...names.map((n) => clips[n].bounds[0])),
    Math.min(...names.map((n) => clips[n].bounds[1])),
    Math.max(...names.map((n) => clips[n].bounds[2])),
    Math.max(...names.map((n) => clips[n].bounds[3]))
  ]
  const abc = (name: string): string[] => [`${name}-start`, `${name}-loop`, `${name}-end`]
  const move = (clip: string, from: Point, to: Point, speed: number): Step => ({
    clip,
    move: { to, duration: Math.max(160, (Math.hypot(to.x - from.x, to.y - from.y) / speed) * 1000) }
  })
  const movement = action.movement
  if (movement.startsWith('walk-') || movement.startsWith('crawl-')) {
    const sign = movement.endsWith('left') ? -1 : 1
    const to = clampPosition({ x: origin.x + sign * 200, y: origin.y }, bounds, union(action.clips))
    return [
      { clip: action.clips[0] },
      move(action.clips[1], origin, to, movement.startsWith('crawl') ? 70 : 110),
      { clip: action.clips[2] }
    ]
  }
  const side = origin.x + PET_SIZE / 2 < bounds.width / 2 ? 'left' : 'right'
  const edge = (name: string, point: Point): Point =>
    clampPosition({ ...point, x: side === 'left' ? -10000 : 10000 }, bounds, union(abc(name)))
  const name = `${movement === 'hide' ? 'hide' : 'climb'}-${side}`
  const approach = edge(name, origin)
  const steps: Step[] = [
    move(`walk-${side}-loop`, origin, approach, 260),
    { clip: `${name}-start` }
  ]
  if (movement === 'hide') {
    const box = clips[`${name}-loop`].bounds
    const tucked = {
      ...approach,
      x:
        side === 'left'
          ? PET_MARGIN + 56 - (box[2] * PET_SIZE) / 320
          : bounds.width - PET_MARGIN - 56 - (box[0] * PET_SIZE) / 320
    }
    steps.push(
      { clip: `${name}-loop`, peek: side, move: { to: tucked, duration: 450 } },
      { clip: `${name}-loop`, peek: side, repeat: 3 },
      {
        clip: `${name}-end`,
        peek: side,
        move: { to: approach, duration: clips[`${name}-end`].durations.reduce((a, b) => a + b, 0) }
      }
    )
    return steps
  }
  const wallEnd = clampPosition(
    {
      x: approach.x,
      y: movement === 'top' ? -10000 : approach.y + (approach.y > bounds.height / 2 ? -180 : 180)
    },
    bounds,
    union(abc(name))
  )
  steps.push(move(`${name}-loop`, approach, wallEnd, 90), { clip: `${name}-end` })
  if (movement === 'top') {
    const direction = side === 'left' ? 'right' : 'left'
    const topName = `top-${direction}`
    const topBox = union(abc(topName))
    const start = clampPosition({ x: wallEnd.x, y: -10000 }, bounds, topBox)
    steps.push(move(`${topName}-start`, wallEnd, start, 180))
    const end = clampPosition(
      { x: start.x + (side === 'left' ? 240 : -240), y: start.y },
      bounds,
      topBox
    )
    steps.push(move(`${topName}-loop`, start, end, 90), { clip: `${topName}-end` })
  }
  return steps
}
export function phaseLabel(state: PetState): string {
  if (state.action === 'lift') return '被你提起来啦'
  if (state.action === 'drop') return '稳稳落地'
  return ACTIONS[state.action]?.label ?? '自在陪伴中'
}
