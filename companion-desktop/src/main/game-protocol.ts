import { protocol } from 'electron'
import { readFile } from 'node:fs/promises'
import { join, resolve, relative, isAbsolute, extname } from 'node:path'

// Each game gets a separate origin and storage, with no access to the host preload.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'qijian-game',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
  },
  {
    scheme: 'qijian-video',
    privileges: {
      standard: true,
      secure: true,
      stream: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
])

const games = new Set(['bounceback', 'sandspiel', 'hextris', 'fruitbasket'])
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
}

export function registerGameProtocol(): void {
  const root = process.env.ELECTRON_RENDERER_URL
    ? resolve(__dirname, '../../src/renderer/public/games')
    : join(__dirname, '../renderer/games')
  protocol.handle('qijian-game', async (request) => {
    try {
      const url = new URL(request.url)
      if (request.method !== 'GET' || !games.has(url.hostname))
        return new Response(null, { status: 403 })
      const base = join(root, url.hostname)
      const pathname = decodeURIComponent(url.pathname)
      if (pathname.includes('\\') || pathname.includes('\0'))
        return new Response(null, { status: 403 })
      const file = resolve(base, '.' + (pathname === '/' ? '/index.html' : pathname))
      const child = relative(base, file)
      if (child.startsWith('..') || isAbsolute(child)) return new Response(null, { status: 403 })
      const bytes = await readFile(file)
      return new Response(new Uint8Array(bytes), {
        headers: {
          'Content-Type': mime[extname(file).toLowerCase()] || 'application/octet-stream',
          // regl generates its WebGL commands at runtime; only Sandspiel needs unsafe-eval.
          'Content-Security-Policy': `default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${url.hostname === 'sandspiel' ? " 'unsafe-eval'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; media-src 'self' blob:; worker-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'`,
          'X-Content-Type-Options': 'nosniff'
        }
      })
    } catch {
      return new Response('Game resource not found', { status: 404 })
    }
  })
}
