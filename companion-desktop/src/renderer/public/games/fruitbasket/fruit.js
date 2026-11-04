/* Fruit Basket web adaptation for Qijian. Original images/rules: jjkay03.
   This is not the Unity build. Physics: Matter.js 0.20.0 (MIT). */
;(() => {
  const { Engine, Bodies, Body, Composite, Events } = Matter
  const canvas = document.getElementById('fruit-canvas'),
    ctx = canvas.getContext('2d')
  const W = 480,
    H = 640,
    floor = 603,
    limit = 130
  const radii = [13, 19, 25, 31, 39, 48, 58, 70, 83, 98, 114]
  const points = [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55]
  const engine = Engine.create({
    gravity: { x: 0, y: 1.15 },
    positionIterations: 8,
    velocityIterations: 8
  })
  const images = []
  let score = 0,
    best = 0,
    aim = W / 2,
    current = 0,
    next = 0,
    readyAt = 0
  let paused = false,
    lost = false,
    overTime = 0,
    loaded = false,
    keys = new Set(),
    pending = []
  let clock = 0,
    last = 0,
    accumulator = 0,
    mergeCount = 0,
    audio
  try {
    best = Number(localStorage.getItem('qijian-fruit-best')) || 0
  } catch {
    /* Gameplay still works without storage. */
  }
  document.getElementById('best').textContent = best
  const fruits = () => Composite.allBodies(engine.world).filter((b) => Number.isInteger(b.fruit))
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
  const randomFruit = () => {
    const n = Math.random()
    return n < 0.25 ? 0 : n < 0.55 ? 1 : n < 0.85 ? 2 : 3
  }
  function addFruit(tier, x, y) {
    const r = radii[tier]
    const body = Bodies.circle(clamp(x, 27 + r, W - 27 - r), y, r, {
      restitution: 0.12,
      friction: 0.38,
      frictionStatic: 0.7,
      frictionAir: 0.008,
      density: 0.002
    })
    Object.assign(body, { fruit: tier, born: clock, consumed: false })
    Composite.add(engine.world, body)
    return body
  }
  function updateScore(delta) {
    score += delta
    document.getElementById('score').textContent = score
    if (score > best) {
      best = score
      document.getElementById('best').textContent = best
      try {
        localStorage.setItem('qijian-fruit-best', String(best))
      } catch {
        /* Best score becomes session-only. */
      }
    }
  }
  function sound(tier) {
    try {
      audio ||= new AudioContext()
      if (audio.state === 'suspended' && !paused) void audio.resume()
      const oscillator = audio.createOscillator(),
        gain = audio.createGain(),
        t = audio.currentTime
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(340 + tier * 45, t)
      oscillator.frequency.exponentialRampToValueAtTime(570 + tier * 60, t + 0.09)
      gain.gain.setValueAtTime(0.025, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16)
      oscillator.connect(gain)
      gain.connect(audio.destination)
      oscillator.start(t)
      oscillator.stop(t + 0.18)
    } catch {
      /* Audio is optional. */
    }
  }
  function drop() {
    if (!loaded || paused || lost || clock < readyAt) return
    addFruit(current, aim, 92)
    updateScore(points[current])
    current = next
    next = randomFruit()
    document.getElementById('next').src = images[next].toDataURL()
    readyAt = clock + 620
    sound(0)
  }
  function collisions(event) {
    for (const { bodyA: a, bodyB: b } of event.pairs) {
      if (!Number.isInteger(a.fruit) || a.fruit !== b.fruit || a.consumed || b.consumed) continue
      a.consumed = b.consumed = true
      pending.push([a, b])
    }
  }
  Events.on(engine, 'collisionStart', collisions)
  Events.on(engine, 'collisionActive', collisions)
  Events.on(engine, 'afterUpdate', () => {
    for (const [a, b] of pending) {
      Composite.remove(engine.world, a)
      Composite.remove(engine.world, b)
      const tier = a.fruit
      updateScore(points[tier] + tier + 1)
      mergeCount++
      sound(tier)
      if (tier === 10) {
        for (const item of fruits()) {
          updateScore(points[item.fruit])
          Composite.remove(engine.world, item)
        }
        document.getElementById('fruit-toast').textContent = '双西瓜！腾出一篮新空间。'
      } else {
        const merged = addFruit(
          tier + 1,
          (a.position.x + b.position.x) / 2,
          (a.position.y + b.position.y) / 2
        )
        Body.setVelocity(merged, {
          x: (a.velocity.x + b.velocity.x) / 2,
          y: (a.velocity.y + b.velocity.y) / 2
        })
      }
    }
    pending = []
  })
  function reset() {
    Composite.clear(engine.world)
    Engine.clear(engine)
    Composite.add(engine.world, [
      Bodies.rectangle(12, 380, 24, 490, { isStatic: true }),
      Bodies.rectangle(W - 12, 380, 24, 490, { isStatic: true }),
      Bodies.rectangle(W / 2, floor + 14, W, 28, { isStatic: true })
    ])
    score = 0
    current = next = 0
    readyAt = 0
    lost = false
    paused = false
    overTime = 0
    pending = []
    clock = 0
    accumulator = 0
    mergeCount = 0
    updateScore(0)
    document.getElementById('next').src = images[0].toDataURL()
    document.getElementById('fruit-result').hidden = true
    document.getElementById('fruit-toast').textContent = ''
    canvas.focus()
  }
  function setPaused(value) {
    paused = value
    keys.clear()
    if (audio) void (value ? audio.suspend() : audio.resume())
    last = 0
    accumulator = 0
  }
  const move = (event) => {
    const rect = canvas.getBoundingClientRect()
    aim = clamp(
      ((event.clientX - rect.left) / rect.width) * W,
      27 + radii[current],
      W - 27 - radii[current]
    )
  }
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    move(event)
    canvas.focus()
    drop()
  })
  addEventListener('keydown', (event) => {
    if (
      ['ArrowLeft', 'ArrowRight', 'ArrowDown', ' ', 'a', 'd', 's', 'A', 'D', 'S'].includes(
        event.key
      )
    ) {
      event.preventDefault()
      keys.add(event.key.toLowerCase())
      if (!event.repeat && [' ', 'ArrowDown', 's', 'S'].includes(event.key)) drop()
    }
  })
  addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()))
  addEventListener('blur', () => keys.clear())
  document.getElementById('fruit-again').addEventListener('click', reset)
  function render() {
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#fff8e7'
    ctx.beginPath()
    ctx.roundRect(18, limit, W - 36, floor - limit + 14, 18)
    ctx.fill()
    ctx.strokeStyle = '#dab18a'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.roundRect(21, limit, W - 42, floor - limit + 11, 17)
    ctx.stroke()
    ctx.strokeStyle = overTime > 0 ? '#d75a4a' : '#d6b89a'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 8])
    ctx.beginPath()
    ctx.moveTo(27, limit + 8)
    ctx.lineTo(W - 27, limit + 8)
    ctx.stroke()
    ctx.setLineDash([])
    for (const body of fruits()) {
      ctx.save()
      ctx.translate(body.position.x, body.position.y)
      ctx.rotate(body.angle)
      const r = radii[body.fruit]
      ctx.drawImage(images[body.fruit], -r, -r, r * 2, r * 2)
      ctx.restore()
    }
    if (!lost && loaded) {
      aim = clamp(aim, 27 + radii[current], W - 27 - radii[current])
      const r = radii[current]
      ctx.globalAlpha = clock < readyAt ? 0.35 : 1
      ctx.drawImage(images[current], aim - r, 62 - r, r * 2, r * 2)
      ctx.strokeStyle = '#c78e6d'
      ctx.setLineDash([3, 8])
      ctx.beginPath()
      ctx.moveTo(aim, 100)
      ctx.lineTo(aim, floor - 5)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
    }
    for (let i = 0; i < images.length; i++) ctx.drawImage(images[i], 24 + i * 40, 617, 24, 24)
  }
  function frame(timestamp) {
    const delta = last ? Math.min(timestamp - last, 50) : 0
    last = timestamp
    if (!paused && !lost) {
      if (keys.has('arrowleft') || keys.has('a')) aim -= delta * 0.4
      if (keys.has('arrowright') || keys.has('d')) aim += delta * 0.4
      accumulator += delta
      while (accumulator >= 1000 / 60) {
        clock += 1000 / 60
        Engine.update(engine, 1000 / 60)
        accumulator -= 1000 / 60
      }
      const overflowing = fruits().some(
        (b) =>
          !b.consumed &&
          clock - b.born > 1600 &&
          b.position.y - radii[b.fruit] < limit &&
          b.speed < 1.5
      )
      overTime = overflowing ? overTime + delta : 0
      if (overTime > 2200) {
        lost = true
        if (parent === window) document.getElementById('fruit-result').hidden = false
      }
    }
    if (loaded) render()
    requestAnimationFrame(frame)
  }
  window.qijianIsReady = () => loaded
  window.qijianGameResult = () => (lost ? 'lost' : null)
  window.qijianSetPaused = setPaused
  // Read-only diagnostics used by the actual-window gameplay checks.
  window.FruitBasket = {
    status: () => ({
      score,
      best,
      count: fruits().length,
      tiers: fruits().map((b) => b.fruit),
      mergeCount,
      paused,
      lost,
      clock
    })
  }
  Promise.all(
    Array.from(
      { length: 11 },
      (_, i) =>
        new Promise((resolve, reject) => {
          const image = new Image()
          image.onload = () => {
            // Unity sprites include transparent padding; fit visible pixels to the physics circle.
            const source = document.createElement('canvas')
            source.width = image.width
            source.height = image.height
            const context = source.getContext('2d')
            context.drawImage(image, 0, 0)
            const pixels = context.getImageData(0, 0, image.width, image.height).data
            let left = image.width,
              top = image.height,
              right = 0,
              bottom = 0
            for (let y = 0; y < image.height; y++)
              for (let x = 0; x < image.width; x++) {
                if (pixels[(y * image.width + x) * 4 + 3] > 10) {
                  left = Math.min(left, x)
                  right = Math.max(right, x)
                  top = Math.min(top, y)
                  bottom = Math.max(bottom, y)
                }
              }
            const sprite = document.createElement('canvas')
            sprite.width = right - left + 1
            sprite.height = bottom - top + 1
            sprite
              .getContext('2d')
              .drawImage(
                image,
                left,
                top,
                sprite.width,
                sprite.height,
                0,
                0,
                sprite.width,
                sprite.height
              )
            images[i] = sprite
            resolve()
          }
          image.onerror = reject
          image.src = `fruit-${i}.png`
        })
    )
  )
    .then(() => {
      loaded = true
      reset()
      requestAnimationFrame(frame)
    })
    .catch(() => parent.postMessage({ type: 'qijian:error' }, '*'))
})()
