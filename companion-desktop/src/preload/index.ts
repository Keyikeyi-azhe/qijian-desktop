import type { LocalToolRequest } from '../shared/companion-agent'
import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { VideoAPI } from '../shared/videos'
import type { CompanionAPI, ChatUpdate } from '../shared/companion'

const companion: CompanionAPI = {
  load: () => ipcRenderer.invoke('companion:load'),
  memory: () => ipcRenderer.invoke('companion:memory'),
  updateMemory: (command) => ipcRenderer.invoke('companion:updateMemory', command),
  configure: (settings) => ipcRenderer.invoke('companion:configure', settings),
  test: () => ipcRenderer.invoke('companion:test'),
  testVision: () => ipcRenderer.invoke('companion:testVision'),
  send: (request) => ipcRenderer.invoke('companion:send', request),
  cancel: (id) => ipcRenderer.invoke('companion:cancel', id),
  clear: () => ipcRenderer.invoke('companion:clear'),
  toolResult: (reply) => ipcRenderer.invoke('companion:tool-result', reply),
  onToolRequest: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, request: LocalToolRequest): void =>
      callback(request)
    ipcRenderer.on('companion:tool-request', listener)
    return () => ipcRenderer.removeListener('companion:tool-request', listener)
  },
  onUpdate: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, update: ChatUpdate): void =>
      callback(update)
    ipcRenderer.on('companion:update', listener)
    return () => ipcRenderer.removeListener('companion:update', listener)
  }
}
contextBridge.exposeInMainWorld('companion', companion)
const videos: VideoAPI = {
  list: () => ipcRenderer.invoke('videos:list'),
  choose: (categoryId) => ipcRenderer.invoke('videos:choose', categoryId),
  importFiles: (files, categoryId) =>
    ipcRenderer.invoke(
      'videos:import',
      files.map((file) => webUtils.getPathForFile(file)),
      categoryId
    ),
  update: (id, patch) => ipcRenderer.invoke('videos:update', id, patch),
  remove: (id) => ipcRenderer.invoke('videos:remove', id),
  category: (action, name, id) => ipcRenderer.invoke('videos:category', action, name, id),
  onProgress: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      value: { current: number; total: number; name: string }
    ): void => callback(value)
    ipcRenderer.on('videos:progress', listener)
    return () => ipcRenderer.removeListener('videos:progress', listener)
  }
}
contextBridge.exposeInMainWorld('videos', videos)

// Only exposes window visibility; no arbitrary IPC or Node access in the renderer.
contextBridge.exposeInMainWorld('companionWindow', {
  onVisibilityChange(callback: (visible: boolean) => void): () => void {
    const listener = (_event: Electron.IpcRendererEvent, visible: unknown): void => {
      if (typeof visible === 'boolean') callback(visible)
    }
    ipcRenderer.on('companion-window-visible', listener)
    return () => ipcRenderer.removeListener('companion-window-visible', listener)
  }
})
