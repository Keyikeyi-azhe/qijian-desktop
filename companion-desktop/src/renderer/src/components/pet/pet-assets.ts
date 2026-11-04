import manifest from '../../assets/vpet/manifest.json'
export type Clip = {
  file: string
  size: number
  columns: number
  durations: number[]
  hitboxes: number[][]
  bounds: number[]
}
export const clips: Record<string, Clip> = manifest
const urls = import.meta.glob<string>('../../assets/vpet/atlases/*.webp', {
  eager: true,
  query: '?url',
  import: 'default'
})
const images = new Map<string, Promise<HTMLImageElement>>()
export function atlas(name: string): Promise<HTMLImageElement> {
  const existing = images.get(name)
  if (existing) {
    images.delete(name)
    images.set(name, existing)
    return existing
  }
  const clip = clips[name]
  if (!clip) return Promise.reject(new Error(`Unknown VPet clip: ${name}`))
  const promise = (async () => {
    const image = new Image()
    image.src = urls[`../../assets/vpet/atlases/${clip.file}`]
    await image.decode()
    return image
  })()
  images.set(name, promise)
  void promise.catch(() => {
    if (images.get(name) === promise) images.delete(name)
  })
  // Keep recently used decoded atlases, not the entire animation library.
  while (images.size > 18) images.delete(images.keys().next().value!)
  return promise
}
export async function preloadPet(): Promise<void> {
  await Promise.all(
    [
      'idle',
      'lift-start',
      'lift-loop',
      'drag',
      'drop',
      'touch-start',
      'touch-loop',
      'touch-end',
      'happy'
    ].map(atlas)
  )
}
