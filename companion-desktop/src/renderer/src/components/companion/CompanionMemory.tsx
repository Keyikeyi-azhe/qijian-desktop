import { useEffect, useState } from 'react'
import type { MemoryCommand, MemorySnapshot } from '../../../../shared/companion'

export function CompanionMemory(): React.JSX.Element {
  const [memory, setMemory] = useState<MemorySnapshot | null>(null)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  useEffect(() => {
    const api = window.companion
    if (!api) return
    let live = true
    const refresh = (): void => {
      void api
        .memory()
        .then((value) => {
          if (live) setMemory(value)
        })
        .catch(() => {
          if (live) setError('记忆读取失败，请重新打开设置。')
        })
    }
    refresh()
    const unsubscribe = api.onUpdate((update) => {
      if (update.memoryChanged) refresh()
    })
    return () => {
      live = false
      unsubscribe()
    }
  }, [])
  const update = async (command: MemoryCommand): Promise<boolean> => {
    setBusy(true)
    setError('')
    try {
      if (!window.companion) throw new Error('请在桌面程序中使用记忆。')
      setMemory(await window.companion.updateMemory(command))
      return true
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message.replace(/^Error invoking remote method '[^']+': Error: /, '')
          : '记忆保存失败。'
      )
      return false
    } finally {
      setBusy(false)
    }
  }
  return (
    <details className="companion-memory">
      <summary>记忆 · {memory?.items.length ?? 0} 条</summary>
      {memory && (
        <>
          <label className="companion-check">
            <input
              type="checkbox"
              checked={memory.enabled}
              disabled={busy}
              onChange={(event) => void update({ action: 'toggle', enabled: event.target.checked })}
            />
            自动整理我说过的偏好与目标
          </label>
          <small>
            符合条件的聊天会在回答后额外调用模型整理，可能产生少量费用。关闭后保留已有记忆；截图不会变成长期记忆。
          </small>
          {memory.pending && <p role="status">正在整理这次聊天中的记忆…</p>}
          {memory.error && <p role="status">{memory.error}</p>}
          {!memory.items.length && (
            <p>还没有长期记忆。可以告诉波奇酱“我最近在练人物速写”，也可以在下面添加。</p>
          )}
          {memory.items.map((item) => (
            <article className="companion-memory-item" key={item.id}>
              <p>{item.text}</p>
              <small>
                {item.source === 'automatic' ? '从你的原话整理' : '你添加或修改的'} ·{' '}
                {new Date(item.updatedAt).toLocaleDateString()}
              </small>
              <div className="companion-actions">
                <button
                  disabled={busy}
                  aria-label={`编辑记忆：${item.text}`}
                  onClick={() => {
                    setEditing(item.id)
                    setDraft(item.text)
                  }}
                >
                  编辑
                </button>
                <button
                  disabled={busy}
                  aria-label={`删除记忆：${item.text}`}
                  onClick={async () => {
                    if ((await update({ action: 'delete', id: item.id })) && editing === item.id) {
                      setEditing(undefined)
                      setDraft('')
                    }
                  }}
                >
                  删除
                </button>
              </div>
            </article>
          ))}
          <label>
            {editing ? '修改这条记忆' : '添加一条记忆'}
            <textarea
              aria-label="记忆内容"
              value={draft}
              maxLength={240}
              rows={2}
              placeholder="例如：我最近在练人物速写，希望多给构图建议。"
              onChange={(event) => setDraft(event.target.value)}
            />
          </label>
          <div className="companion-actions">
            <button
              disabled={busy || !draft.trim()}
              onClick={async () => {
                if (await update({ action: 'save', id: editing, text: draft })) {
                  setEditing(undefined)
                  setDraft('')
                }
              }}
            >
              保存记忆
            </button>
            {editing && (
              <button
                onClick={() => {
                  setEditing(undefined)
                  setDraft('')
                }}
              >
                取消编辑
              </button>
            )}
          </div>
          {memory.items.length > 0 && (
            <button
              disabled={busy}
              onClick={async () => {
                if (!confirmClear) {
                  setConfirmClear(true)
                  return
                }
                if (await update({ action: 'clear' })) {
                  setConfirmClear(false)
                  setEditing(undefined)
                  setDraft('')
                }
              }}
            >
              {confirmClear ? '确认清空全部长期记忆' : '清空全部长期记忆'}
            </button>
          )}
          {confirmClear && <button onClick={() => setConfirmClear(false)}>取消清空</button>}
          <small>
            删除长期记忆不会删除聊天记录，也不会清空上方手填的称呼和偏好。需要一起移除时请分别清空。
          </small>
          <details>
            <summary>近期活动摘要 · 聊天与点评共用</summary>
            <small>保留最近24小时的聊天话题和画面点评，各最多4条；旧点评不代表当前画面。</small>
            {memory.activity.length ? (
              memory.activity.map((entry, index) => (
                <p key={`${entry.at}-${index}`}>
                  {entry.kind === 'user' ? '你聊到' : '波奇酱观察到'}：{entry.text}
                </p>
              ))
            ) : (
              <p>暂时没有近期活动。</p>
            )}
            <button
              disabled={busy || !memory.activity.length}
              onClick={() => void update({ action: 'clearActivity' })}
            >
              清空近期活动
            </button>
          </details>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </details>
  )
}
