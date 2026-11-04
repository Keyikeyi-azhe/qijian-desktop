// This module is imported before Excalidraw evaluates its font URLs.
export {}
declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string
  }
}
window.EXCALIDRAW_ASSET_PATH = new URL('./excalidraw/', document.baseURI).href
