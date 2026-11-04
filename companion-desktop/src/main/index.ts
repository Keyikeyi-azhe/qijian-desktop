import { app, BrowserWindow, Menu, shell } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import icon from '../../build/icon.png?asset'
import { registerGameProtocol } from './game-protocol'
import { registerCompanion } from './companion/service'
import { VideoLibrary } from './video-library'
import { registerVideoIPC, registerVideoProtocol } from './video-service'
let videos: VideoLibrary

if (app.isPackaged && !app.commandLine.hasSwitch('user-data-dir')) {
  app.setPath('userData', join(app.getPath('appData'), '栖间正式版'))
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1440,
    height: 860,
    minWidth: 1060,
    minHeight: 760,
    title: '栖间 · 你的日常陪伴空间',
    icon,
    backgroundColor: '#252c3a',
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#252c3a', symbolColor: '#e4e7ee', height: 36 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  window.once('ready-to-show', () => window.show())
  registerCompanion(window.webContents)
  registerVideoIPC(window.webContents, videos)
  const notifyVisible = (visible: boolean): void => {
    if (!window.webContents.isDestroyed())
      window.webContents.send('companion-window-visible', visible && !window.isMinimized())
  }
  window.on('minimize', () => notifyVisible(false))
  window.on('hide', () => notifyVisible(false))
  window.on('restore', () => notifyVisible(true))
  window.on('show', () => notifyVisible(true))
  window.webContents.on('did-finish-load', () =>
    notifyVisible(window.isVisible() && !window.isMinimized())
  )
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (
      ['https://github.com/LorisYounger/VPet', 'https://github.com/excalidraw/excalidraw'].includes(
        url
      )
    )
      void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerGameProtocol()
  const seed = join(process.resourcesPath, 'starter-videos')
  videos = new VideoLibrary(
    join(app.getPath('userData'), 'videos'),
    existsSync(join(seed, 'library.json')) ? seed : undefined
  )
  registerVideoProtocol(videos)
  app.setAppUserModelId('studio.qijian.companion')
  Menu.setApplicationMenu(null)
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
