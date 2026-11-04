import type { Bounds } from '../pet/pet-model'
export type PetRectangle = { left: number; top: number; right: number; bottom: number }
export function bubbleLayout(
  bounds: Bounds,
  pet: PetRectangle,
  size: Bounds
): { left: number; top: number; width: number; side: 'above' | 'left' | 'right'; tail: number } {
  const margin = 8,
    gap = 12
  const width = Math.min(size.width, bounds.width - margin * 2)
  const center = (pet.left + pet.right) / 2
  const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(v, max))
  if (pet.top - gap - size.height >= margin) {
    const preferred =
      center + 10 + width <= bounds.width - margin ? center + 10 : center - width - 10
    const left = clamp(preferred, margin, bounds.width - width - margin)
    return {
      left,
      top: pet.top - gap - size.height,
      width,
      side: 'above',
      tail: clamp(center - left, 12, width - 12)
    }
  }
  const rightRoom = bounds.width - margin - pet.right - gap
  const leftRoom = pet.left - gap - margin
  const right = rightRoom >= width || rightRoom >= leftRoom
  const available = Math.max(1, right ? rightRoom : leftRoom)
  const fittedWidth = Math.min(width, available)
  const top = clamp(pet.top, margin, bounds.height - size.height - margin)
  return {
    left: right ? pet.right + gap : pet.left - gap - fittedWidth,
    top,
    width: fittedWidth,
    side: right ? 'right' : 'left',
    tail: clamp(pet.top + 24 - top, 12, size.height - 12)
  }
}
