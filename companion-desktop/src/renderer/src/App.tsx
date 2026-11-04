import { DeskScene } from './components/desk/DeskScene'
import animationLicense from './assets/vpet/ANIMATION-LICENSE.txt?raw'

function App(): React.JSX.Element {
  return (
    <div className="desktop-shell">
      <header className="titlebar">
        <details className="app-about">
          <summary aria-label="栖间 · 关于角色与动画">栖间</summary>
          <div className="app-about-content">
            <strong>萝莉斯 · VPet</strong>
            <p>角色与动画：虚拟主播模拟器制作组</p>
            <a href="https://github.com/LorisYounger/VPet" target="_blank" rel="noreferrer">
              访问 VPet 开源项目 ↗
            </a>
            <pre>{animationLicense}</pre>
          </div>
        </details>
      </header>
      <DeskScene />
    </div>
  )
}

export default App
