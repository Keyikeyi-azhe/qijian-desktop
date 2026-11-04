import switchImage from '../../assets/desk-scene/scene-switch.png'
import type { Theme } from './useSceneTheme'

export function SceneSwitch({
  theme,
  automatic,
  onClick
}: {
  theme: Theme
  automatic: boolean
  onClick: () => void
}): React.JSX.Element {
  const label = `切换为${theme === 'day' ? '夜晚' : '白天'}`
  return (
    <button
      className="scene-switch"
      onClick={onClick}
      aria-label={label}
      title={`${label}${automatic ? ' · 10 秒后恢复当前时段' : ' · 保持手动背景'}`}
    >
      <img className="scene-switch-body" src={switchImage} alt="" draggable={false} />
      <span>{label}</span>
    </button>
  )
}
