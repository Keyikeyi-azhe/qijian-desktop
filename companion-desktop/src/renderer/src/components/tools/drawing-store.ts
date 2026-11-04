import starterDrawing from './starter-drawing.json'

const DATABASE = 'qijian-drawing'
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => request.result.createObjectStore('documents')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('画板存储被其他窗口占用'))
  })
}
export async function readDrawing(key = 'scene'): Promise<string | null> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('documents', 'readonly')
    const request = transaction.objectStore('documents').get(key)
    transaction.oncomplete = () => {
      db.close()
      resolve(request.result ?? null)
    }
    transaction.onabort = () => {
      db.close()
      reject(transaction.error)
    }
  })
}
export async function writeDrawing(scene: string, key = 'scene'): Promise<void> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('documents', 'readwrite')
    try {
      transaction.objectStore('documents').put(scene, key)
    } catch (error) {
      db.close()
      reject(error)
      return
    }
    transaction.oncomplete = () => {
      db.close()
      resolve()
    }
    transaction.onabort = () => {
      db.close()
      reject(transaction.error)
    }
  })
}

export type DrawingBoard = { id: string; name: string; scene: string | null; closed?: boolean }
export type DrawingWorkspace = { version: 1; activeId: string; boards: DrawingBoard[] }
export function parseDrawingWorkspace(raw: string): DrawingWorkspace {
  const data = JSON.parse(raw)
  if (data?.version !== 1 || !Array.isArray(data.boards)) throw new Error('Invalid workspace')
  const ids = new Set<string>()
  for (const board of data.boards) {
    if (
      typeof board?.id !== 'string' ||
      !board.id ||
      ids.has(board.id) ||
      typeof board.name !== 'string' ||
      !board.name.trim() ||
      board.name.length > 40 ||
      (board.scene !== null && typeof board.scene !== 'string')
    )
      throw new Error('Invalid board')
    ids.add(board.id)
  }
  if (typeof data.activeId !== 'string' || (data.activeId !== '' && !ids.has(data.activeId)))
    throw new Error('Missing active board')
  return data
}
export async function readDrawingWorkspace(): Promise<DrawingWorkspace> {
  const raw = await readDrawing('workspace')
  if (raw !== null) return parseDrawingWorkspace(raw)
  const legacy = await readDrawing()
  const scene = legacy ?? JSON.stringify(starterDrawing)
  return {
    version: 1,
    activeId: 'original',
    boards: [{ id: 'original', name: '画布 1', scene }]
  }
}
export async function writeDrawingWorkspace(workspace: DrawingWorkspace): Promise<void> {
  await writeDrawing(JSON.stringify(workspace), 'workspace')
}

