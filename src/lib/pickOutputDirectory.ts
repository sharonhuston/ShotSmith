/** File System Access API — not in all environments; returns null if unavailable. */
let directoryPickerInFlight: Promise<FileSystemDirectoryHandle> | null = null

/**
 * Picks a writable directory. If called again before the first dialog finishes, returns the
 * same in-flight Promise so the browser is never asked for two pickers at once (avoids
 * "File picker already active" / `InvalidStateError`).
 */
export async function pickWritableDirectory(): Promise<FileSystemDirectoryHandle | null> {
  const g = globalThis as unknown as {
    showDirectoryPicker?: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>
  }
  if (typeof g.showDirectoryPicker !== 'function') return null

  if (directoryPickerInFlight) {
    return directoryPickerInFlight
  }

  const p = g.showDirectoryPicker({ mode: 'readwrite' })
  directoryPickerInFlight = p
  void p.finally(() => {
    directoryPickerInFlight = null
  })
  return p
}
