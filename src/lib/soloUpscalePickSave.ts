import { buildSoloOutputName, extensionForImageMime } from './naming'
import { firstAvailableNumberedName, saveArrayBufferToDirectory } from './savePngToDirectory'

export type FileWithHandle = {
  file: File
  /** Present when the user picked via File System Access (Chromium). */
  fileHandle: FileSystemFileHandle | null
}

/**
 * Tries the File System Access `getParent` API so we can write next to the original file.
 */
export async function getParentDirectory(
  fileHandle: FileSystemFileHandle
): Promise<FileSystemDirectoryHandle | null> {
  const h = fileHandle as FileSystemFileHandle & {
    getParent?: () => Promise<FileSystemDirectoryHandle>
  }
  if (typeof h.getParent === 'function') {
    try {
      return await h.getParent()
    } catch {
      return null
    }
  }
  return null
}

type OpenFilePickerOptions = {
  types: { description: string; accept: Record<string, string[]> }[]
  multiple: boolean
}

const IMAGE_PICKER_TYPES: OpenFilePickerOptions['types'] = [
  { description: 'Images', accept: { 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'] } },
]

/**
 * Picks one or more images (Ctrl+Click in the system dialog for multiple). Uses
 * `showOpenFilePicker` when available so handles (and parent dirs) are kept.
 */
export async function pickImageFiles(): Promise<FileWithHandle[]> {
  if (typeof window !== 'undefined' && 'showOpenFilePicker' in window) {
    try {
      const w = window as unknown as {
        showOpenFilePicker: (opt: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>
      }
      const handles = await w.showOpenFilePicker({
        types: IMAGE_PICKER_TYPES,
        multiple: true,
      })
      const out: FileWithHandle[] = []
      for (const handle of handles) {
        const file = await handle.getFile()
        if (file.type.startsWith('image/')) {
          out.push({ file, fileHandle: handle })
        }
      }
      return out
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return []
      throw e
    }
  }
  return []
}

/** @returns stem without extension, and extension including dot or '' */
export function filenameStemAndExt(name: string): { stem: string; ext: string } {
  const t = name.trim()
  const m = /^(.+?)(\.[^./\\]+)$/.exec(t)
  if (m) {
    return { stem: m[1]!, ext: m[2]! }
  }
  return { stem: t, ext: '' }
}

export type SoloSaveOutcome = {
  filename: string
  /** Folder that contains the saved file, when the File System Access API exposes it. */
  containingDirectory: FileSystemDirectoryHandle | null
}

/**
 * Save next to the original when we have a directory handle; otherwise `showSaveFilePicker` or download.
 * `nameKind` controls the filename: `name_cleanup.png` or `name_upscale.png`.
 */
export async function saveSoloResult(
  data: ArrayBuffer,
  outMime: string,
  sourceFilename: string,
  sourceFileHandle: FileSystemFileHandle | null,
  nameKind: 'upscale' | 'cleanup'
): Promise<SoloSaveOutcome> {
  const ext = extensionForImageMime(outMime)
  const { stem } = filenameStemAndExt(sourceFilename)
  const safeStem = stem || 'image'

  const tryDir = sourceFileHandle ? await getParentDirectory(sourceFileHandle) : null

  if (tryDir) {
    const name = await firstAvailableNumberedName(tryDir, 0, (n) =>
      buildSoloOutputName(safeStem, ext, n, nameKind)
    )
    await saveArrayBufferToDirectory(tryDir, name, data)
    return { filename: name, containingDirectory: tryDir }
  }

  const suggested = buildSoloOutputName(safeStem, ext, 0, nameKind)
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    const w = window as unknown as {
      showSaveFilePicker: (opt: {
        suggestedName: string
        types?: { description: string; accept: Record<string, string[]> }[]
      }) => Promise<FileSystemFileHandle>
    }
    try {
      const h = await w.showSaveFilePicker({
        suggestedName: suggested,
        types: [
          { description: 'Image', accept: { 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'] } },
        ],
      })
      const writable = await h.createWritable()
      try {
        await writable.write(data)
      } finally {
        await writable.close()
      }
      const containingDirectory = await getParentDirectory(h)
      return { filename: h.name, containingDirectory }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        throw e
      }
      // User activation may be gone after long async; fall back to download with correct filename.
    }
  }

  if (typeof document !== 'undefined') {
    const blob = new Blob([data], { type: outMime || 'image/png' })
    const url = URL.createObjectURL(blob)
    try {
      const a = document.createElement('a')
      a.href = url
      a.download = suggested
      a.rel = 'noopener'
      a.click()
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 2_000)
    }
    return { filename: suggested, containingDirectory: null }
  }

  throw new Error('Could not save the file.')
}

export async function saveSoloUpscaleResult(
  data: ArrayBuffer,
  outMime: string,
  sourceFilename: string,
  sourceFileHandle: FileSystemFileHandle | null
): Promise<SoloSaveOutcome> {
  return saveSoloResult(data, outMime, sourceFilename, sourceFileHandle, 'upscale')
}

export async function saveSoloCleanupResult(
  data: ArrayBuffer,
  outMime: string,
  sourceFilename: string,
  sourceFileHandle: FileSystemFileHandle | null
): Promise<SoloSaveOutcome> {
  return saveSoloResult(data, outMime, sourceFilename, sourceFileHandle, 'cleanup')
}

/**
 * Opens the system folder picker. Uses the save folder when known; otherwise starts from the
 * user’s Downloads directory (well-known in Chromium). There is no standard API to open the OS
 * file manager directly from a path or handle.
 */
export async function openSaveFolderPicker(
  containingDirectory: FileSystemDirectoryHandle | null
): Promise<void> {
  if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) return
  const w = window as unknown as {
    showDirectoryPicker: (opt?: {
      startIn?: FileSystemDirectoryHandle | 'downloads'
      mode?: 'read' | 'readwrite'
    }) => Promise<FileSystemDirectoryHandle>
  }
  try {
    if (containingDirectory) {
      await w.showDirectoryPicker({ startIn: containingDirectory, mode: 'read' })
    } else {
      await w.showDirectoryPicker({ startIn: 'downloads', mode: 'read' })
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return
    throw e
  }
}
