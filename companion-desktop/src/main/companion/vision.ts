import { BrowserWindow, nativeImage, type WebContents } from 'electron'
import type { CaptureArea, CaptureRect } from '../../shared/companion'

function rectangle(value: CaptureRect): boolean {
  return (
    value &&
    [value.x, value.y, value.width, value.height].every(Number.isFinite) &&
    value.x >= 0 &&
    value.y >= 0 &&
    value.width > 0 &&
    value.height > 0
  )
}
export async function captureCompanionScene(
  owner: WebContents,
  area: CaptureArea
): Promise<{ url: string; signature: Buffer }> {
  const window = BrowserWindow.fromWebContents(owner)
  if (!window || !window.isVisible() || window.isMinimized())
    throw new Error('窗口不可见，已暂停识图。')
  const [width, height] = window.getContentSize()
  if (
    !rectangle(area?.rect) ||
    area.rect.x + area.rect.width > width + 1 ||
    area.rect.y + area.rect.height > height + 1 ||
    !Array.isArray(area.masks) ||
    area.masks.length > 12
  )
    throw new Error('截图区域无效。')
  const rect = {
    x: Math.floor(area.rect.x),
    y: Math.floor(area.rect.y),
    width: Math.floor(area.rect.width),
    height: Math.floor(area.rect.height)
  }
  let picture = await owner.capturePage(rect)
  if (picture.isEmpty()) throw new Error('当前窗口无法截图。')
  picture = picture.resize({ width: Math.min(960, picture.getSize().width) })
  const size = picture.getSize(),
    bitmap = picture.toBitmap({ scaleFactor: 1 })
  const scaleX = size.width / rect.width,
    scaleY = size.height / rect.height
  for (const mask of area.masks) {
    if (!rectangle(mask)) continue
    const x0 = Math.max(0, Math.floor((mask.x - rect.x) * scaleX)),
      y0 = Math.max(0, Math.floor((mask.y - rect.y) * scaleY))
    const x1 = Math.min(size.width, Math.ceil((mask.x + mask.width - rect.x) * scaleX)),
      y1 = Math.min(size.height, Math.ceil((mask.y + mask.height - rect.y) * scaleY))
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = (y * size.width + x) * 4
        bitmap[i] = 235
        bitmap[i + 1] = 235
        bitmap[i + 2] = 235
        bitmap[i + 3] = 255
      }
  }
  const cleaned = nativeImage.createFromBitmap(bitmap, size)
  return {
    url: `data:image/jpeg;base64,${cleaned.toJPEG(70).toString('base64')}`,
    signature: cleaned.resize({ width: 64, height: 48 }).toBitmap({ scaleFactor: 1 })
  }
}
export function changedFrame(previous: Uint8Array | null, next: Uint8Array): boolean {
  if (!previous || previous.length !== next.length) return true
  let changed = 0
  for (let i = 0; i < next.length; i += 4) {
    if (
      Math.abs(previous[i] - next[i]) +
        Math.abs(previous[i + 1] - next[i + 1]) +
        Math.abs(previous[i + 2] - next[i + 2]) >
      75
    )
      changed++
  }
  return changed / (next.length / 4) > 0.04
}
export function visionTestImage(): string {
  const pixels = Buffer.alloc(64 * 64 * 4)
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 220
    pixels[i + 1] = 70
    pixels[i + 2] = 30
    pixels[i + 3] = 255
  }
  return nativeImage.createFromBitmap(pixels, { width: 64, height: 64 }).toDataURL()
}
