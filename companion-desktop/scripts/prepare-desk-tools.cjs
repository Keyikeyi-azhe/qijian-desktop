const fs = require('node:fs')
const path = require('node:path')
const project = path.resolve(__dirname, '..')
const output = path.join(project, 'src/renderer/public/excalidraw/fonts')
fs.mkdirSync(output, { recursive: true })
fs.cpSync(path.join(project, 'node_modules/@excalidraw/excalidraw/dist/prod/fonts'), output, {
  recursive: true
})
const licenses = path.join(project, 'src/renderer/public/licenses/desk-tools')
fs.mkdirSync(licenses, { recursive: true })
for (const [pkg, name] of [
  ['ts-fsrs', 'ts-fsrs'],
  ['@open-spaced-repetition/srs-kit', 'srs-kit']
]) {
  fs.copyFileSync(
    path.join(project, 'node_modules', pkg, 'LICENSE'),
    path.join(licenses, `${name}.txt`)
  )
}
console.log('画板字体与复习引擎许可证已准备好。')
