import { useEffect, useRef, useState } from 'react'
import { GearSixIcon, ArrowLeftIcon, XIcon } from '@phosphor-icons/react'
import { ACTION_GROUPS } from '../pet/pet-actions'
import type { CompanionController } from './useCompanion'
import type { Bounds, Point } from '../pet/pet-model'
import './companion.css'
import { CompanionMemory } from './CompanionMemory'

export function CompanionPanel({
  chat,
  position,
  bounds,
  onClose,
  onAction
}: {
  chat: CompanionController
  position: Point
  bounds: Bounds
  onClose: () => void
  onAction: (action: string) => void
}): React.JSX.Element {
  const input = useRef<HTMLTextAreaElement>(null)
  const bottom = useRef<HTMLDivElement>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [history, setHistory] = useState(false)
  const width = Math.min(320, bounds.width - 16)
  const left = Math.max(
    8,
    Math.min(
      position.x > width ? position.x - width + 45 : position.x + 160,
      bounds.width - width - 8
    )
  )
  const top = Math.max(
    8,
    Math.min(position.y - 120, bounds.height - (chat.settingsOpen ? 540 : history ? 460 : 320))
  )
  useEffect(() => {
    input.current?.focus()
  }, [chat.settingsOpen])
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest' })
  }, [chat.messages])
  return (
    <section
      className={`companion-panel${chat.settingsOpen || history ? ' is-expanded' : ''}`}
      aria-label="和波奇酱聊聊"
      style={{ left, top, width, maxHeight: bounds.height - top - 8 }}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape') {
          e.preventDefault()
          if (chat.settingsOpen) chat.setSettingsOpen(false)
          else if (history) setHistory(false)
          else onClose()
        }
      }}
    >
      <header className="companion-heading">
        {chat.settingsOpen && (
          <button className="companion-back" onClick={() => chat.setSettingsOpen(false)}>
            <ArrowLeftIcon size={16} /> 返回聊天
          </button>
        )}
        <div>
          <strong>波奇酱</strong>
          <small>{chat.busy ? '正在认真想……' : '在这里，陪你一会儿'}</small>
        </div>
        <button
          type="button"
          onClick={() => chat.setSettingsOpen(!chat.settingsOpen)}
          aria-expanded={chat.settingsOpen}
          aria-label="陪伴设置"
          title="陪伴设置"
        >
          <GearSixIcon size={20} />
        </button>
        <button type="button" onClick={onClose} aria-label="收起聊天">
          <XIcon size={18} />
        </button>
      </header>
      {chat.settingsOpen ? (
        <Settings chat={chat} />
      ) : (
        <>
          {history && (
            <div className="companion-messages" aria-label="聊天记录">
              {!chat.messages.length && (
                <div className="companion-empty">
                  <p>那个……想说什么都可以。</p>
                  <p>也可以问我，栖间里的东西怎么用。</p>
                  <button onClick={() => chat.setDraft('怎么使用便签并导出备份？')}>
                    便签怎么用？
                  </button>
                  <button onClick={() => chat.setDraft('今天有点累，我只想聊聊。')}>
                    我想聊一会儿
                  </button>
                </div>
              )}
              {chat.messages.map((message, index) => (
                <article key={index} className={`companion-message is-${message.role}`}>
                  <span>{message.role === 'user' ? chat.settings.nickname || '你' : '波奇酱'}</span>
                  <p>
                    {message.content ||
                      (chat.busy && index === chat.messages.length - 1
                        ? '让我想一想……'
                        : '这次没有收到回答。')}
                  </p>
                  {message.status === 'stopped' && <small>已停止生成</small>}
                  {message.status === 'error' && <small>本次回答未完成</small>}
                </article>
              ))}
              <div ref={bottom} />
            </div>
          )}
          <div className="companion-composer">
            <label htmlFor="companion-input">想和波奇酱说的话</label>
            <textarea
              id="companion-input"
              ref={input}
              maxLength={3000}
              rows={2}
              value={chat.draft}
              placeholder="问问软件怎么用，或聊聊今天……"
              onChange={(e) => chat.setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === 'Enter' &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing &&
                  e.keyCode !== 229
                ) {
                  e.preventDefault()
                  void chat.send()
                }
              }}
            />
            <div className="companion-actions">
              <small>Enter 发送 · Shift+Enter 换行</small>
              {chat.busy ? (
                <button onClick={() => void chat.stop()}>停止生成</button>
              ) : (
                <button
                  disabled={!chat.loaded || !chat.draft.trim()}
                  onClick={() => void chat.send()}
                >
                  发送
                </button>
              )}
            </div>
            <div className="companion-history-actions">
              <button onClick={() => setHistory(!history)}>
                {history ? '收起记录' : '聊天记录'}
              </button>
              <button
                disabled={chat.busy || !chat.loaded}
                onClick={() => void chat.send(false, true)}
              >
                看看当前画面
              </button>
              {confirmClear ? (
                <>
                  <span>清空本机聊天记录？</span>
                  <button
                    disabled={chat.busy}
                    onClick={() => {
                      void chat.clear()
                      setConfirmClear(false)
                    }}
                  >
                    确认清空
                  </button>
                  <button onClick={() => setConfirmClear(false)}>取消</button>
                </>
              ) : (
                <button
                  disabled={chat.busy || !chat.messages.length}
                  onClick={() => setConfirmClear(true)}
                >
                  清空对话
                </button>
              )}
            </div>
          </div>
          <details className="companion-pet-actions">
            <summary>动作与互动</summary>
            {ACTION_GROUPS.map((group) => (
              <details key={group.label}>
                <summary>{group.label}</summary>
                <div>
                  {group.actions.map((action) => (
                    <button
                      key={action.id}
                      data-action={action.id}
                      onClick={() => onAction(action.id)}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </details>
            ))}
          </details>
        </>
      )}
      {chat.error && (
        <div className="companion-error" role="alert">
          {chat.error}
          {!chat.busy && chat.canRetry && !chat.settingsOpen && (
            <button onClick={() => void chat.send(true)}>重试</button>
          )}
        </div>
      )}
      <div className="visually-hidden" role="status">
        {chat.busy ? '波奇酱正在回答' : '可以继续聊天'}
      </div>
    </section>
  )
}

function Settings({ chat }: { chat: CompanionController }): React.JSX.Element {
  const [model, setModel] = useState(chat.settings.model)
  const [key, setKey] = useState('')
  const [nickname, setNickname] = useState(chat.settings.nickname)
  const [preference, setPreference] = useState(chat.settings.preference)
  const [proactive, setProactive] = useState(chat.settings.proactive)
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState('')
  const [appearance, setAppearance] = useState(chat.settings)
  const save = async (test = false, removeKey = false, visionTest = false): Promise<void> => {
    if (!window.companion) return
    setPending(true)
    setNotice('')
    chat.setError('')
    try {
      const result = await window.companion.configure({
        ...appearance,
        model,
        key,
        nickname,
        preference,
        proactive,
        removeKey
      })
      chat.setSettings(result)
      window.dispatchEvent(new CustomEvent('qijian-scene-settings', { detail: result.autoScene }))
      setKey('')
      setNotice(
        visionTest
          ? await window.companion.testVision()
          : test
            ? await window.companion.test()
            : removeKey
              ? '本机密钥已删除。'
              : '设置已保存。'
      )
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message.replace(/^Error invoking remote method '[^']+': Error: /, '')
          : '保存或连接失败，请重试。'
      )
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="companion-settings">
      <p>DeepSeek 官方平台 · api.deepseek.com</p>
      <label>
        API Key
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          maxLength={1000}
          value={key}
          placeholder={chat.settings.hasKey ? '已保存，留空保留现有密钥' : '在此粘贴你的 API Key'}
          onChange={(e) => setKey(e.target.value)}
        />
      </label>
      <label>
        模型 ID
        <input
          value={model}
          maxLength={100}
          spellCheck={false}
          onChange={(e) => setModel(e.target.value)}
        />
      </label>
      <small>“保存并测试”查询账户模型列表；“测试识图”发送一张纯色测试图。</small>
      <label>
        怎么称呼你
        <input value={nickname} maxLength={60} onChange={(e) => setNickname(e.target.value)} />
      </label>
      <label>
        希望我记住的偏好
        <textarea
          value={preference}
          maxLength={600}
          rows={2}
          placeholder="例如：回答简短一点，难过时先听我说。"
          onChange={(e) => setPreference(e.target.value)}
        />
      </label>
      <CompanionMemory />
      <label className="companion-check">
        <input
          type="checkbox"
          role="switch"
          checked={appearance.autoScene}
          onChange={(e) => setAppearance({ ...appearance, autoScene: e.target.checked })}
        />
        是否按照当前时间变换场景
      </label>
      <small>
        保存后生效。本机 6:00–18:00 为白天；左上角按钮可切换昼夜，自动模式下 10
        秒后恢复。关闭后保留手动选择，未选择时显示白天。
      </small>
      <label className="companion-check">
        <input
          type="checkbox"
          checked={proactive}
          onChange={(e) => setProactive(e.target.checked)}
        />
        操作后偶尔用气泡回应
      </label>
      <p className="companion-privacy">
        聊天与画面点评会发送相关长期记忆、近期活动和偏好；聊天还会发送输入及近期对话。开启窗口识图后，当前栖间画面（可能包含便签正文）会发送给
        DeepSeek；不截取其他软件，截图仅在内存使用，处理后释放。
      </p>
      <label>
        活泼程度
        <select
          value={appearance.activity}
          onChange={(e) =>
            setAppearance({ ...appearance, activity: e.target.value as typeof appearance.activity })
          }
        >
          <option value="lively">活泼 · 常常动一动</option>
          <option value="balanced">适中 · 偶尔互动</option>
          <option value="quiet">安静 · 少打扰</option>
        </select>
      </label>
      <label>
        气泡字体
        <select
          value={appearance.font}
          onChange={(e) =>
            setAppearance({ ...appearance, font: e.target.value as typeof appearance.font })
          }
        >
          <option value="rounded">软糖体 · dsh-pet 同款</option>
          <option value="system">系统字体</option>
          <option value="serif">书页宋体</option>
        </select>
      </label>
      <label>
        气泡字号 {appearance.fontSize}px
        <input
          type="range"
          min={11}
          max={22}
          value={appearance.fontSize}
          onChange={(e) => setAppearance({ ...appearance, fontSize: Number(e.target.value) })}
        />
      </label>
      <label>
        回复语言
        <select
          value={appearance.language}
          onChange={(e) =>
            setAppearance({ ...appearance, language: e.target.value as typeof appearance.language })
          }
        >
          <option value="zh-CN">中文</option>
          <option value="en">English</option>
        </select>
      </label>
      <label className="companion-check">
        <input
          type="checkbox"
          checked={appearance.vision}
          onChange={(e) => setAppearance({ ...appearance, vision: e.target.checked })}
        />
        允许观察当前栖间窗口
      </label>
      <label>
        观察间隔
        <select
          value={appearance.visionInterval}
          onChange={(e) => setAppearance({ ...appearance, visionInterval: Number(e.target.value) })}
        >
          <option value={3}>3 秒</option>
          <option value={5}>5 秒</option>
          <option value={10}>10 秒</option>
          <option value={15}>15 秒</option>
          <option value={30}>30 秒</option>
          <option value={60}>60 秒</option>
        </select>
      </label>
      <small>
        内容不变、正在输入、窗口隐藏时跳过。关闭识图仍可根据本地功能数据回应；关闭主动回应才停止自动陪伴。模型调用会产生费用。
      </small>
      <div className="companion-actions">
        <button disabled={pending || chat.busy || !chat.loaded} onClick={() => void save()}>
          保存设置
        </button>
        <button disabled={pending || chat.busy || !chat.loaded} onClick={() => void save(true)}>
          {pending ? '处理中…' : '保存并测试'}
        </button>
      </div>
      {chat.settings.hasKey && (
        <button disabled={pending || chat.busy} onClick={() => void save(false, false, true)}>
          测试识图
        </button>
      )}
      {chat.settings.hasKey && (
        <button disabled={pending || chat.busy} onClick={() => void save(false, true)}>
          删除本机密钥
        </button>
      )}
      {notice && <p role="status">{notice}</p>}
    </div>
  )
}
