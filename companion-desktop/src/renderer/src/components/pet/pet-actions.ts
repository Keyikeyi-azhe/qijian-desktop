export type ActionDefinition = {
  id: string
  label: string
  clips: string[]
  loops?: number
  movement?: 'walk-left' | 'walk-right' | 'crawl-left' | 'crawl-right' | 'climb' | 'top' | 'hide'
}
const sequence = (name: string): string[] => [`${name}-start`, `${name}-loop`, `${name}-end`]
export const ACTION_GROUPS: { label: string; actions: ActionDefinition[] }[] = [
  {
    label: '日常待机',
    actions: [
      { id: 'idle', label: '自在站立', clips: ['idle'] },
      { id: 'bubbles', label: '吹泡泡', clips: sequence('bubbles') },
      { id: 'squat', label: '蹲一会儿', clips: sequence('squat'), loops: 2 },
      { id: 'meow', label: '学猫咪', clips: ['meow'] },
      { id: 'cute', label: '探头卖萌', clips: ['cute'] },
      { id: 'bored', label: '发一会儿呆', clips: sequence('bored') },
      { id: 'yawn', label: '打哈欠', clips: ['yawn'] }
    ]
  },
  {
    label: '亲密互动',
    actions: [
      { id: 'touch', label: '摸摸头', clips: [...sequence('touch'), 'happy'] },
      { id: 'body', label: '摸摸身体', clips: sequence('body') },
      { id: 'pinch', label: '捏捏脸', clips: sequence('pinch') }
    ]
  },
  {
    label: '生活照料',
    actions: [
      { id: 'eat', label: '吃块面包', clips: ['eat'] },
      { id: 'drink', label: '喝点水', clips: ['drink'] },
      { id: 'gift', label: '送个小礼物', clips: ['gift'] },
      { id: 'sleep', label: '睡一会儿', clips: ['sleep-start', 'sleep-loop'] },
      { id: 'wake', label: '起床啦', clips: ['sleep-end'] }
    ]
  },
  {
    label: '学习创作',
    actions: [
      { id: 'study', label: '一起看书', clips: sequence('study'), loops: 2 },
      { id: 'research', label: '认真研究', clips: sequence('research'), loops: 3 },
      { id: 'calligraphy', label: '练练书法', clips: sequence('calligraphy'), loops: 2 },
      { id: 'paint', label: '画一幅画', clips: sequence('paint'), loops: 2 }
    ]
  },
  {
    label: '娱乐活动',
    actions: [
      { id: 'ball', label: '玩球', clips: sequence('ball'), loops: 2 },
      { id: 'game', label: '玩游戏', clips: sequence('game'), loops: 2 },
      { id: 'music', label: '跟着音乐摇摆', clips: sequence('music'), loops: 2 },
      { id: 'rope', label: '跳绳', clips: sequence('rope'), loops: 3 },
      { id: 'water', label: '玩水', clips: sequence('water'), loops: 2 }
    ]
  },
  {
    label: '窗口移动',
    actions: [
      { id: 'walk-left', label: '向左走走', clips: sequence('walk-left'), movement: 'walk-left' },
      {
        id: 'walk-right',
        label: '向右走走',
        clips: sequence('walk-right'),
        movement: 'walk-right'
      },
      {
        id: 'crawl-left',
        label: '向左爬爬',
        clips: sequence('crawl-left'),
        movement: 'crawl-left'
      },
      {
        id: 'crawl-right',
        label: '向右爬爬',
        clips: sequence('crawl-right'),
        movement: 'crawl-right'
      },
      { id: 'climb', label: '就近爬墙', clips: [], movement: 'climb' },
      { id: 'top', label: '沿窗口顶边爬', clips: [], movement: 'top' },
      { id: 'hide', label: '去侧边躲一会儿', clips: [], movement: 'hide' }
    ]
  },
  {
    label: '心情与庆祝',
    actions: [
      { id: 'happy', label: '开心一下', clips: ['happy'], loops: 2 },
      { id: 'poor', label: '有点没精神', clips: ['poor'], loops: 2 },
      { id: 'ill', label: '生病的样子', clips: ['ill'], loops: 2 },
      { id: 'level-up', label: '升级庆祝', clips: ['level-up'] },
      { id: 'birthday', label: '生日庆祝', clips: sequence('birthday') }
    ]
  }
]
export const ACTIONS = Object.fromEntries(
  ACTION_GROUPS.flatMap((group) => group.actions.map((action) => [action.id, action]))
) as Record<string, ActionDefinition>
export const IDLE_ACTIONS = [
  'happy',
  'music',
  'ball',
  'paint',
  'study',
  'drink',
  'bubbles',
  'squat',
  'meow',
  'cute',
  'bored',
  'yawn',
  'walk-left',
  'walk-right'
]
