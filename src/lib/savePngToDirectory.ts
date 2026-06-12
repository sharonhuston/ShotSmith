/** True if a file with this name already exists in the directory. */
export async function fileExistsInDirectory(
  dir: FileSystemDirectoryHandle,
  filename: string
): Promise<boolean> {
  try {
    await dir.getFileHandle(filename, { create: false })
    return true
  } catch {
    return false
  }
}

/**
 * Chooses a filename that does not already exist, by trying `startN` first, then
 * `startN + 1`, `startN + 2`, … with the given `build` function. Does not delete or
 * overwrite any existing file.
 */
export async function firstAvailableNumberedName(
  dir: FileSystemDirectoryHandle,
  startN: number,
  build: (n: number) => string
): Promise<string> {
  const cap = 100_000
  for (let k = 0; k < cap; k++) {
    const n = startN + k
    const name = build(n)
    if (!(await fileExistsInDirectory(dir, name))) {
      return name
    }
  }
  throw new Error('Could not find a free output filename (too many existing files with this name pattern).')
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const n = bin.length
  const u = new Uint8Array(n)
  for (let i = 0; i < n; i++) u[i] = bin.charCodeAt(i)
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength)
}

/** Write a PNG (or any binary) given as base64 to a file in a directory handle. */
export async function saveBase64ImageToDirectory(
  dir: FileSystemDirectoryHandle,
  filename: string,
  base64: string
): Promise<void> {
  const fh = await dir.getFileHandle(filename, { create: true })
  const w = await fh.createWritable()
  try {
    await w.write(base64ToArrayBuffer(base64))
  } finally {
    await w.close()
  }
}

export async function saveArrayBufferToDirectory(
  dir: FileSystemDirectoryHandle,
  filename: string,
  data: ArrayBuffer
): Promise<void> {
  const fh = await dir.getFileHandle(filename, { create: true })
  const writable = await fh.createWritable()
  try {
    await writable.write(data)
  } finally {
    await writable.close()
  }
}
