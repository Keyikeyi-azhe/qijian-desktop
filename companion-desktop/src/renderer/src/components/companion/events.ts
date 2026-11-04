export type CompanionEvent = {
  kind: 'scene' | 'todo' | 'review' | 'note' | 'game' | 'drawing' | 'video'
  detail: string
  count?: number
  revision?: string
}
let scene = '书桌',
  recent: string[] = []
let revision = ''
export function companionScene(): string {
  return scene
}
export function companionRevision(): string {
  return revision
}
export function companionEvent(event: CompanionEvent): void {
  if (event.kind === 'scene') {
    scene = event.detail
    recent = []
    revision = ''
  } else recent = [...recent, event.detail.slice(0, 150)].slice(-4)
  if (event.revision) revision = event.revision
  window.dispatchEvent(new CustomEvent('qijian:companion-event', { detail: event }))
}
export function companionContext(): string {
  return `当前功能：${scene}。本机时间：${new Date().toLocaleString('zh-CN')}。近期操作（不包含正文）：${recent.join('；') || '暂无'}。`
}
export function eventReply(
  event: CompanionEvent,
  language = 'zh-CN',
  variation = 0
): string | null {
  if (event.kind === 'scene' && event.detail === '书桌') return null
  if (language === 'en') {
    if (event.kind === 'scene')
      return /drawing/.test(event.detail)
        ? 'A little drawing time? I’ll keep you company.'
        : /game/.test(event.detail)
          ? 'Let’s take a little play break.'
          : /memo/.test(event.detail)
            ? 'A place for whatever is on your mind.'
            : /vocabulary/.test(event.detail)
              ? 'One word at a time. I’m here with you.'
              : /calendar/.test(event.detail)
                ? 'Let’s leave a little breathing room in your plans.'
                : 'Back at our desk. Take your time.'
    if (event.kind === 'todo')
      return event.detail === '完成待办'
        ? 'One more thing done. That counts!'
        : 'Your plans are saved. One step at a time.'
    if (event.kind === 'video') return 'A little movie break? I’m here.'
    if (event.kind === 'note') return 'Saved. A little less for your head to carry.'
    if (event.kind === 'drawing') return 'Your drawing is saved. Keep going at your own pace.'
    if (event.kind === 'review' && event.count)
      return `That’s ${event.count} reviews today. Little steps add up.`
    if (event.kind === 'game')
      return event.detail.includes('won')
        ? 'You did it! That was worth sticking with.'
        : 'A little break? I’ll be here.'
    return null
  }
  if (event.kind === 'scene' && /video/.test(event.detail)) return '片单在这儿。场外观众也就位了。'
  if (event.kind === 'video') return '收好啦，留给想放松的时候。'
  if (event.kind === 'scene')
    return /drawing/.test(event.detail)
      ? '开画啦。我先把脑内的橡皮擦收起来。'
      : /game/.test(event.detail)
        ? '开一局。我的场外紧张已经就位了。'
        : /memo/.test(event.detail)
          ? '先写下来，脑内弹幕也需要个收纳盒。'
          : /vocabulary/.test(event.detail)
            ? '今天又要和这群字母见面了。'
            : /calendar/.test(event.detail)
              ? '让我看看日历，今天是谁在排队。'
              : '回到书桌啦……慢慢来，我也坐一会儿。'
  if (event.kind === 'drawing')
    return event.detail === '新建画布'
      ? '新画布。空白的时候反而最紧张……'
      : ['我先闭嘴，当一会儿场外观众。', '画笔还没下班，我也还在。', '撤销键在呢，可以大胆一点。'][
          variation % 3
        ]
  if (event.kind === 'todo' && event.detail === '更新待办列表')
    return '安排进日历了，脑袋可以少开一个窗口。'
  if (event.kind === 'todo' && event.detail === '完成待办') return '划掉了。这个勾，看着就很解气。'
  if (event.kind === 'note')
    return [
      '记下来了。这下不用靠脑内循环播放了。',
      '这张纸先替你保管着。',
      '有时候先写乱一点，反而能继续往下写。'
    ][variation % 3]
  if (event.kind === 'review' && event.count)
    return `今天已经复习 ${event.count} 次了！我、我刚刚有偷偷帮你数。`
  if (event.kind === 'game' && event.detail === '游戏结束：won')
    return '赢了！我刚才差点比你先屏住呼吸。'
  if (event.kind === 'game' && event.detail === '游戏结束：lost')
    return '啊……这局没过。先不急着骂自己。'
  if (event.kind === 'game' && event.detail === '暂停游戏') return '暂停键，人类之光。'
  return null
}
