/**
 * Sends the reference to Gemini at high quality: original PNG/JPEG bytes when possible.
 * Only resamples if the file is too large for the API (big dimension or big byte size).
 */

const MAX_LONG_EDGE_PX = 4096
/** If the file is under this size and within MAX_LONG_EDGE_PX, we pass the original bytes (no re-compression). */
const MAX_BYTES_DIRECT = 5 * 1024 * 1024

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunk = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunk) as unknown as number[]
    )
  }
  return btoa(binary)
}

export type PreparedImageForGemini = {
  base64: string
  mimeType: string
  /** Human-readable note for logging / UI */
  preparationNote: string
}

function normalizeMime(file: File): string {
  const t = file.type
  if (t === 'image/png' || t === 'image/jpeg') return t
  return 'image/jpeg'
}

/**
 * Prefer original file for vibe analysis. Resample only when dimensions or file size are too large.
 */
export async function prepareImageForGemini(
  file: File,
  options?: { signal?: AbortSignal }
): Promise<PreparedImageForGemini> {
  if (options?.signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  const buffer = await file.arrayBuffer()
  if (options?.signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  const img = await createImageBitmap(new Blob([buffer], { type: file.type || 'image/jpeg' }))
  try {
    const w = img.width
    const h = img.height
    const longEdge = Math.max(w, h)
    const needsResize = longEdge > MAX_LONG_EDGE_PX || buffer.byteLength > MAX_BYTES_DIRECT

    if (!needsResize) {
      return {
        base64: arrayBufferToBase64(buffer),
        mimeType: normalizeMime(file),
        preparationNote: `Original image sent (${w}×${h}px, ${(buffer.byteLength / 1024).toFixed(0)} KB)`,
      }
    }

    if (options?.signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    const scale = MAX_LONG_EDGE_PX / longEdge
    const tw = Math.max(1, Math.round(w * scale))
    const th = Math.max(1, Math.round(h * scale))

    const canvas = document.createElement('canvas')
    canvas.width = tw
    canvas.height = th
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get canvas context')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, tw, th)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
    )
    if (!blob) throw new Error('Failed to encode image for API')
    if (options?.signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    const outBuf = await blob.arrayBuffer()
    return {
      base64: arrayBufferToBase64(outBuf),
      mimeType: 'image/jpeg',
      preparationNote: `Resampled to ${tw}×${th}px (max long edge ${MAX_LONG_EDGE_PX}px, high-quality JPEG) — original was ${w}×${h}px, ${(buffer.byteLength / 1024).toFixed(0)} KB`,
    }
  } finally {
    img.close()
  }
}
