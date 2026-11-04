interface Window {
  videos?: import('../../shared/videos').VideoAPI
  companion?: import('../../shared/companion').CompanionAPI
  companionWindow?: {
    onVisibilityChange: (callback: (visible: boolean) => void) => () => void
  }
}
