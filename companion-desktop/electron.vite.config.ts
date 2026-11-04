import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [
      {
        name: 'excalidraw-local-font-fallback',
        enforce: 'pre',
        transform(code, id) {
          if (
            !id.replaceAll('\\', '/').includes('/@excalidraw/excalidraw/dist/') ||
            !code.includes('ASSETS_FALLBACK_URL')
          )
            return
          // 0.18.1 always appends a CDN fallback, even with EXCALIDRAW_ASSET_PATH.
          // Keep the fallback local too, including Chromium's font-source CSP checks.
          const fallback = /"ASSETS_FALLBACK_URL",\s*`https:\/\/esm\.sh\/[\s\S]*?\/dist\/prod\/`/
          if (!fallback.test(code))
            throw new Error(
              'Excalidraw font fallback changed; review the offline asset adaptation.'
            )
          return {
            code: code.replace(
              fallback,
              '"ASSETS_FALLBACK_URL", new URL("./excalidraw/", document.baseURI).href'
            ),
            map: null
          }
        }
      },
      react()
    ]
  }
})
