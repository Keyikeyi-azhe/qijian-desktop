import { registerLiveData } from '../companion/live-data'
import { useEffect, useRef, useState } from 'react'
import { PlusIcon, TrashIcon, DownloadSimpleIcon, UploadSimpleIcon } from '@phosphor-icons/react'
import { NOTES_KEY, NOTE_COLORS, parseNotes, type Note } from './notes-model'
import { downloadText, useLocalDocument, type ToolProps } from './tool-storage'
import { companionEvent } from '../companion/events'

export default function NotesPanel({ setCloseGuard }: ToolProps): React.JSX.Element {
  const { data, save, error, dirty, readOnly } = useLocalDocument(NOTES_KEY, parseNotes)
  const [selected, setSelected] = useState(data.notes[0]?.id ?? '')
  const [notice, setNotice] = useState('')
  const [deleted, setDeleted] = useState<Note | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const note = data.notes.find((n) => n.id === selected)
  useEffect(() => registerLiveData('notes-view', () => ({ selected })), [selected])
  useEffect(() => {
    setCloseGuard(() => !dirty.current)
  }, [dirty, setCloseGuard])
  const update = (patch: Partial<Note>): void => {
    if (!note) return
    const saved = save({
      ...data,
      notes: data.notes.map((n) =>
        n.id === note.id ? { ...n, ...patch, updated: new Date().toISOString() } : n
      )
    })
    if (saved) companionEvent({ kind: 'note', detail: '便签编辑已保存' })
  }
  const add = (): void => {
    if (data.notes.length >= 500) {
      setNotice('最多保存 500 张便签，请先整理或导出。')
      return
    }
    const next: Note = {
      id: crypto.randomUUID(),
      title: '',
      body: '',
      color: 'cream',
      updated: new Date().toISOString()
    }
    save({ ...data, notes: [next, ...data.notes] })
    setSelected(next.id)
  }
  const exportNotes = (): void => {
    downloadText(
      '栖间-便签.json',
      readOnly ? (localStorage.getItem(NOTES_KEY) ?? '') : JSON.stringify(data, null, 2)
    )
  }
  return (
    <div className="notes-panel">
      <aside className="notes-sidebar">
        <div className="tool-section-heading">
          <h2>留在纸上的事</h2>
          <span>{data.notes.length} 张</span>
        </div>
        <button className="tool-primary" onClick={add} disabled={readOnly}>
          <PlusIcon size={18} />
          新建便签
        </button>
        <nav className="notes-list" aria-label="我的便签">
          {data.notes.map((n) => (
            <button
              key={n.id}
              data-color={n.color}
              aria-current={selected === n.id ? 'true' : undefined}
              onClick={() => setSelected(n.id)}
            >
              <strong>{n.title.trim() || '无标题便签'}</strong>
              <span>{n.body.slice(0, 60) || '写下一点什么…'}</span>
            </button>
          ))}
        </nav>
        <div className="tool-actions">
          <button onClick={exportNotes}>
            <DownloadSimpleIcon />
            导出备份
          </button>
          <button disabled={readOnly} onClick={() => file.current?.click()}>
            <UploadSimpleIcon />
            导入
          </button>
        </div>
        <input
          hidden
          ref={file}
          type="file"
          accept=".json,application/json"
          onChange={async (event) => {
            const input = event.currentTarget,
              chosen = input.files?.[0]
            input.value = ''
            if (!chosen) return
            try {
              if (chosen.size > 10_000_000) throw new Error('文件过大')
              const imported = parseNotes(await chosen.text())
              if (data.notes.length + imported.notes.length > 500)
                throw new Error('便签总数超过 500 张')
              const additions = imported.notes.map((n) => ({ ...n, id: crypto.randomUUID() }))
              save({ ...data, notes: [...additions, ...data.notes] })
              if (additions[0]) setSelected(additions[0].id)
              setNotice(`已导入 ${additions.length} 张便签，原便签已保留。`)
            } catch {
              setNotice('导入失败：请使用栖间导出的 JSON，文件不超过 10 MB，总数不超过 500 张。')
            }
          }}
        />
      </aside>
      <section className="notes-workspace">
        {error && (
          <p className="tool-error" role="alert">
            {error} {!readOnly && <button onClick={() => save(data)}>重试保存</button>}
          </p>
        )}
        {notice && (
          <p className="tool-notice" role="status">
            {notice}
          </p>
        )}
        {deleted && (
          <p className="tool-notice">
            已删除便签。
            <button
              onClick={() => {
                save({ ...data, notes: [deleted, ...data.notes] })
                setSelected(deleted.id)
                setDeleted(null)
              }}
            >
              撤销删除
            </button>
          </p>
        )}
        {note ? (
          <div className="note-sheet" data-color={note.color}>
            <div className="note-controls">
              <div className="note-colors" aria-label="便签颜色">
                {NOTE_COLORS.map((color, i) => (
                  <button
                    key={color}
                    data-color={color}
                    aria-label={['奶油色', '玫瑰色', '鼠尾草色', '薰衣草色'][i]}
                    aria-pressed={note.color === color}
                    disabled={readOnly}
                    onClick={() => update({ color })}
                  />
                ))}
              </div>
              <button
                disabled={readOnly}
                aria-label="删除当前便签"
                onClick={() => {
                  save({ ...data, notes: data.notes.filter((n) => n.id !== note.id) })
                  setDeleted(note)
                  setSelected(data.notes.find((n) => n.id !== note.id)?.id ?? '')
                }}
              >
                <TrashIcon size={20} />
              </button>
            </div>
            <input
              className="note-title"
              aria-label="便签标题"
              maxLength={120}
              placeholder="给这一页起个名字"
              value={note.title}
              disabled={readOnly}
              onChange={(e) => update({ title: e.target.value })}
            />
            <textarea
              aria-label="便签正文"
              maxLength={20000}
              placeholder="今天想记住什么？"
              value={note.body}
              disabled={readOnly}
              onChange={(e) => update({ body: e.target.value })}
            />
            <footer>
              <span>{note.body.length.toLocaleString()} / 20,000 字</span>
              <span role="status">{dirty.current ? '尚未保存' : '已保存到这台电脑'}</span>
            </footer>
          </div>
        ) : (
          <div className="tool-empty">
            <p className="tool-eyebrow">一页空白，等你的想法</p>
            <h2>把想记住的事留在这里</h2>
            <p>灵感、计划，或明天想对自己说的话。</p>
            <button className="tool-primary" disabled={readOnly} onClick={add}>
              写第一张便签
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
