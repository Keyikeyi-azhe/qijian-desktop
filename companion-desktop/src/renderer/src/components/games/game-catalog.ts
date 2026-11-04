export const games = [
  {
    id: 'bounceback',
    title: '回旋镖冒险',
    original: 'Bounce Back',
    category: '动作 · 闯关',
    description: '带上回旋镖，去下一片小小荒野。',
    controls: 'WASD 移动 · 鼠标瞄准与投掷 · 空格冲刺',
    credit: 'Frank Force · GPL-2.0-or-later',
    color: '#6c967a'
  },
  {
    id: 'sandspiel',
    title: '元素沙盘',
    original: 'Sandspiel',
    category: '沙盒 · 解压',
    description: '一把沙，一点火，随手造一个世界。',
    controls: '选择元素后按住鼠标绘制 · 圆点调整笔刷 · 清空重新开始',
    credit: 'Max Bittker · MIT · 本地离线适配',
    color: '#ab8656'
  },
  {
    id: 'hextris',
    title: '六角消除',
    original: 'Hextris',
    category: '益智 · 短局',
    description: '转一转，让相同颜色碰个面。',
    controls: '左右方向键旋转 · 下方向键加速 · P 暂停',
    credit: 'Logan Engstrom / Garrett Finucane / Noah Moroze / Michael Yang · GPL-3.0-or-later',
    color: '#8878a6'
  },
  {
    id: 'fruitbasket',
    title: '水果篮子',
    original: 'Fruit Basket',
    category: '合成 · 物理',
    description: '从一颗小樱桃，慢慢合成大西瓜。',
    controls: '鼠标移动与点击投放，或 A/D、左右键移动，空格投放',
    credit: 'jjkay03 · 栖间网页适配版 · Matter.js / MIT；原项目素材授权待核实，仅本地体验',
    color: '#c67a65'
  }
] as const

export type GameId = (typeof games)[number]['id']
