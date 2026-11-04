export type VideoItem = {
  id: string
  title: string
  categoryId: string
  filename: string
  size: number
  hash: string
  addedAt: string
  duration: number
  position: number
}
export type VideoCategory = { id: string; name: string }
export type VideoLibraryState = { version: 1; items: VideoItem[]; categories: VideoCategory[] }
export type VideoPatch = {
  title?: string
  categoryId?: string
  duration?: number
  position?: number
}
export type VideoImportResult = {
  library: VideoLibraryState
  imported: number
  duplicates: number
  errors: string[]
}
export type VideoAPI = {
  list: () => Promise<VideoLibraryState>
  choose: (categoryId: string) => Promise<VideoImportResult | null>
  importFiles: (files: File[], categoryId: string) => Promise<VideoImportResult>
  update: (id: string, patch: VideoPatch) => Promise<VideoLibraryState>
  remove: (id: string) => Promise<VideoLibraryState>
  category: (
    action: 'add' | 'rename' | 'remove',
    name: string,
    id?: string
  ) => Promise<VideoLibraryState>
  onProgress: (
    callback: (progress: { current: number; total: number; name: string }) => void
  ) => () => void
}
export const VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogv', 'ogg', 'm4v', 'mov', 'mkv']
export function videoURL(id: string): string {
  return `qijian-video://library/${encodeURIComponent(id)}`
}
