/* Qijian: game code lives in an isolated local origin, without host APIs. */
;(() => {
  const id = location.hostname
  const send = (type, extra = {}) => parent.postMessage({ type, ...extra }, '*')
  window.qijianHostPaused = false
  function setPaused(value) {
    window.qijianHostPaused = value
    window.qijianSetPaused?.(value)
    if (id === 'bounceback' && typeof zzfx_x !== 'undefined' && zzfx_x)
      void (value ? zzfx_x.suspend() : zzfx_x.resume())
    document.querySelectorAll('audio,video').forEach((el) => {
      el.muted = value
    })
    send('qijian:paused', { value })
  }
  addEventListener('message', (event) => {
    if (
      event.source === parent &&
      event.data?.type === 'qijian:pause' &&
      typeof event.data.value === 'boolean'
    )
      setPaused(event.data.value)
  })
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) setPaused(true)
  })
  document.addEventListener(
    'click',
    (event) => {
      if (event.target.closest?.('a')) {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
    },
    true
  )
  window.open = () => null
  let finished = false
  setInterval(() => {
    try {
      const result = window.qijianGameResult?.()
      if (result && !finished) send('qijian:ended', { result })
      finished = Boolean(result)
    } catch {
      /* The game has not initialized its state yet. */
    }
  }, 200)
  let lastTelemetry = ''
  setInterval(() => {
    try {
      let value = {}
      if (id === 'fruitbasket' && window.FruitBasket) {
        const state = window.FruitBasket.status()
        value = {
          score: state.score,
          best: state.best,
          count: state.count,
          mergeCount: state.mergeCount
        }
      } else if (id === 'hextris' && typeof score === 'number') value = { score }
      else if (id === 'bounceback' && typeof levelNumber === 'number')
        value = { level: levelNumber }
      else if (id === 'sandspiel' && window.UI?.state) {
        const state = window.UI.state
        value = { selectedElement: state.selectedElement, brushSize: state.size }
      }
      const signature = JSON.stringify(value)
      if (signature !== lastTelemetry) {
        lastTelemetry = signature
        send('qijian:telemetry', { value })
      }
    } catch {
      /* Wait for this game's own state to initialise. */
    }
  }, 1000)
  let attempts = 0
  const check = setInterval(() => {
    let ready = false
    try {
      ready =
        id === 'sandspiel' ? Boolean(window.u && window.UI) : Boolean(window.qijianIsReady?.())
    } catch {
      /* Game declarations are still initializing. */
    }
    if (ready) {
      clearInterval(check)
      if (id === 'sandspiel')
        window.qijianSetPaused = (value) => {
          window.paused = value
          window.UI.setState({ paused: value })
        }
      send('qijian:ready')
    } else if (++attempts > 140) {
      clearInterval(check)
      send('qijian:error')
    }
  }, 200)
  if (id === 'sandspiel') {
    const labels = {
      Reset: '清空',
      Wind: '风',
      Empty: '橡皮',
      Wall: '墙',
      Sand: '沙',
      Water: '水',
      Gas: '气体',
      Cloner: '复制',
      Fire: '火',
      Wood: '木',
      Lava: '岩浆',
      Ice: '冰',
      Plant: '植物',
      Acid: '酸',
      Dust: '尘',
      Stone: '石',
      Oil: '油',
      Mite: '虫',
      Fungus: '菌',
      Seed: '种子',
      Rocket: '火箭'
    }
    const clean = () => {
      document.querySelectorAll('#ui a, .promo, .submission-title').forEach((el) => {
        el.hidden = true
      })
      document.querySelectorAll('#ui button').forEach((button) => {
        const name = button.textContent.trim()
        if (['Upload', 'Browse', 'Info'].includes(name)) button.hidden = true
        else if (labels[name]) {
          button.setAttribute('aria-label', labels[name])
          button.textContent = labels[name]
        } else if (button.querySelector('svg') && !button.getAttribute('aria-label'))
          button.setAttribute(
            'aria-label',
            button.closest('.sizes') ? '笔刷大小' : '暂停或继续沙盘'
          )
      })
    }
    addEventListener('DOMContentLoaded', () => {
      new MutationObserver(clean).observe(document.getElementById('ui'), {
        childList: true,
        subtree: true
      })
      clean()
    })
  }
})()
