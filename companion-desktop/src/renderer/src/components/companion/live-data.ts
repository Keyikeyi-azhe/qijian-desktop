// Getters expose the live editor state without saving or copying entire documents.
const sources = new Map<string, () => unknown>()
export function registerLiveData(name: string, getter: () => unknown): () => void {
  sources.set(name, getter)
  return () => {
    if (sources.get(name) === getter) sources.delete(name)
  }
}
export function liveData<T>(name: string): T | undefined {
  return sources.get(name)?.() as T | undefined
}
