// Recreate local runtimes from pinned sources; does not touch the app build configuration.
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const root = path.resolve(__dirname, '../..')
const sources = path.join(root, 'third_party/games')
const output = path.join(root, 'companion-desktop/src/renderer/public/games')
const adapters = path.join(__dirname, 'game-adapters')
const read = (p) => fs.readFileSync(p, 'utf8')
const write = (p, text) => {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, text)
}
const copy = (from, to) => {
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.cpSync(from, to, { recursive: true })
}
function upstream(id) {
  const base = path.join(sources, id, 'upstream')
  return path.join(base, fs.readdirSync(base)[0])
}
function replaceOnce(text, from, to) {
  assert(text.includes(from), `Upstream changed: ${from.slice(0, 70)}`)
  return text.replace(from, to)
}
function bridge(html) {
  return html.replace(
    '<head>',
    '<head><meta charset="utf-8"><script src="host-bridge.js"></script>'
  )
}
for (const id of ['bounceback', 'hextris', 'sandspiel', 'fruitbasket']) {
  fs.mkdirSync(path.join(output, id), { recursive: true })
  copy(path.join(adapters, 'host-bridge.js'), path.join(output, id, 'host-bridge.js'))
}
const bounce = upstream('bounceback'),
  bounceOut = path.join(output, 'bounceback')
for (const name of ['game.js', 'gameEngine.js', 'gameEngineDebug.js', 'tiles.png', 'LICENSE'])
  copy(path.join(bounce, name), path.join(bounceOut, name))
write(path.join(bounceOut, 'index.html'), bridge(read(path.join(bounce, 'index.html'))))
let engine = read(path.join(bounce, 'gameEngine.js'))
engine = replaceOnce(
  engine,
  'paused = !debug && !document.hasFocus()',
  'paused = window.qijianHostPaused || (!debug && !document.hasFocus())'
)
write(path.join(bounceOut, 'gameEngine.js'), engine)
write(
  path.join(bounceOut, 'game.js'),
  read(path.join(bounce, 'game.js')) +
    '\nwindow.qijianIsReady = () => Boolean(player && level);\nwindow.qijianGameResult = () => player && (winTimer.IsSet() ? "won" : player.IsDead() ? "lost" : null);\n'
)

const hex = upstream('hextris'),
  hexOut = path.join(output, 'hextris')
for (const name of ['images', 'js', 'style', 'vendor', 'favicon.ico', 'LICENSE.md'])
  copy(path.join(hex, name), path.join(hexOut, name))
let html = read(path.join(hex, 'index.html'))
html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (tag) =>
  /src=['"](?:js|vendor)\//.test(tag) && !tag.includes('rrssb.min.js') ? tag : ''
)
html = html.replace(/<link\b[^>]*(?:https?:|manifest\.webmanifest)[^>]*>/gi, '')
html = html.replace(/onclick="[^"]*window\.open[^"]*"/g, '')
html = bridge(html).replace(
  '</head>',
  '<style>#socialShare,#buttonCont,#badges{display:none!important}body{font-family:Arial,sans-serif}a{pointer-events:none}</style></head>'
)
write(path.join(hexOut, 'index.html'), html)
let hexMain = read(path.join(hex, 'js/main.js'))
hexMain = hexMain.replace(
  /\$\.get\('http:\/\/54\.183\.184\.126\/' \+ String\(score\)\)/,
  '/* Score stays on this device. */'
)
hexMain = replaceOnce(
  hexMain,
  "script.src = 'http://hextris.io/a.js';",
  'return; // No external advertising.'
)
hexMain +=
  '\nwindow.qijianIsReady = () => typeof gameState === "number";\nwindow.qijianSetPaused = (value) => { if ((value && gameState === 1) || (!value && gameState === -1)) { pausable = true; pause() } };\n'
write(path.join(hexOut, 'js/main.js'), hexMain)
fs.appendFileSync(
  path.join(hexOut, 'js/main.js'),
  '\nwindow.qijianGameResult = () => gameState === 2 ? "lost" : null;\n'
)
write(
  path.join(hexOut, 'js/view.js'),
  read(path.join(hex, 'js/view.js')).replace(
    /'paused(?:Android|iOS|Other)': "[^\n]*",/g,
    (line) =>
      line.slice(0, line.indexOf(':')) +
      ': "<div class=\'centeredHeader unselectable\'>已暂停</div>",'
  )
)
write(
  path.join(hexOut, 'js/initialization.js'),
  read(path.join(hex, 'js/initialization.js'))
    .replace(/\(function\(i, s, o, g, r, a, m\)\s*\{[\s\S]*?'ga'\);/, '')
    .replace(/^.*\bga\([^\n]*\n/gm, '')
    .replace(
      /window.onblur = function\(e\) \{[\s\S]*?\n\s*\};/,
      'window.onblur = null; // Host controls pause across iframe focus changes.'
    )
)

const sand = upstream('sandspiel'),
  sandOut = path.join(output, 'sandspiel'),
  webBuild = path.join(sources, 'sandspiel/web-build')
for (const name of fs.readdirSync(webBuild))
  copy(path.join(webBuild, name), path.join(sandOut, name))
copy(path.join(sand, 'assets'), path.join(sandOut, 'assets'))
copy(path.join(sand, 'LICENSE'), path.join(sandOut, 'LICENSE'))
let chunk = read(path.join(sandOut, '86.f9e2667f2667a099e149.js'))
chunk = replaceOnce(chunk, 'window.location.host.startsWith("localhost")||i.Ts(', 'true||i.Ts(')
chunk = replaceOnce(chunk, '"serviceWorker"in navigator&&', 'false&&')
chunk = chunk.replace(/window.addEventListener\("deviceorientation",[^,]+,!0\)/g, 'void 0')
const apiStart = chunk.indexOf('3866(e,t,n){'),
  apiEnd = chunk.indexOf('},3957(', apiStart)
assert(apiStart >= 0 && apiEnd > apiStart, 'Sandspiel cloud module changed')
const offlineApi =
  '3866(e,t,n){"use strict";var auth=()=>({currentUser:null,onAuthStateChanged:cb=>{queueMicrotask(()=>cb(null));return()=>{}}});auth.GoogleAuthProvider={PROVIDER_ID:"google.com"};auth.EmailAuthProvider={PROVIDER_ID:"password"};window.firebase={auth};n.d(t,{C:()=>({}),I:()=>({})})'
chunk = chunk.slice(0, apiStart) + offlineApi + chunk.slice(apiEnd)
write(path.join(sandOut, '86.f9e2667f2667a099e149.js'), chunk)
write(
  path.join(sandOut, 'index.html'),
  '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sandspiel</title><link rel="stylesheet" href="styles.css"><script src="host-bridge.js"></script><script>window.adsbygoogle=[];</script><script defer src="main.js"></script><style>[hidden]{display:none!important}#ui a{display:none!important}#ui button{font-family:Arial,sans-serif}</style></head><body><div id="background"><div id="ui"></div><div id="fps"></div><canvas id="sand-canvas"></canvas><canvas id="fluid-canvas"></canvas></div></body></html>'
)

const fruitOut = path.join(output, 'fruitbasket')
for (const name of ['index.html', 'fruit.js', 'fruit.css'])
  copy(path.join(adapters, 'fruitbasket', name), path.join(fruitOut, name))
copy(
  path.join(sources, 'fruitbasket/vendor/package/build/matter.min.js'),
  path.join(fruitOut, 'matter.min.js')
)
copy(
  path.join(sources, 'fruitbasket/vendor/package/LICENSE'),
  path.join(fruitOut, 'MATTER-LICENSE.txt')
)
const fruitSource = path.join(
  root,
  '游戏体验库/02_水果合成/E_FruitBasket_Unity/源码/Fruit-Basket-b8ff578fc29b38dd66603d62e2ffaa77367867ac'
)
for (let i = 0; i <= 10; i++)
  copy(
    path.join(fruitSource, `Assets/Textures/Fruits/fruit ${i}.png`),
    path.join(fruitOut, `fruit-${i}.png`)
  )
write(
  path.join(fruitOut, 'SOURCE.txt'),
  'Fruit Basket original source: https://github.com/jjkay03/Fruit-Basket\nCommit b8ff578fc29b38dd66603d62e2ffaa77367867ac\nOriginal assets by jjkay03 and credited contributors. No project-wide license verified; local prototype only.\nQijian web adaptation, not the original Unity build. Original fruit images and merge/scoring/queue rules; physics/rendering/UI rewritten with Matter.js 0.20.0 (MIT).\n'
)

for (const id of ['bounceback', 'hextris', 'sandspiel', 'fruitbasket']) {
  const dest = path.join(output, id),
    hashes = {}
  if (id !== 'fruitbasket') {
    copy(path.join(sources, id, 'source.zip'), path.join(dest, 'upstream-source.zip'))
    copy(path.join(sources, id, 'source.json'), path.join(dest, 'source.json'))
  }
  copy(__filename, path.join(dest, 'qijian-prepare.cjs'))
  copy(path.join(root, 'docs/development/game-integration.md'), path.join(dest, 'INTEGRATION.md'))
  function walk(folder) {
    for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
      const p = path.join(folder, item.name)
      if (item.isDirectory()) walk(p)
      else if (item.name !== 'manifest.json')
        hashes[path.relative(dest, p).replaceAll('\\', '/')] = crypto
          .createHash('sha256')
          .update(fs.readFileSync(p))
          .digest('hex')
    }
  }
  walk(dest)
  write(
    path.join(dest, 'manifest.json'),
    JSON.stringify({ id, prepared: '2026-11-04', sha256: hashes }, null, 2)
  )
}
console.log('Prepared four isolated local game runtimes.')
