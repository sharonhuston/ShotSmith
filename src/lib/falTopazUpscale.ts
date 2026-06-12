import { fal } from '@fal-ai/client'
import { getFalApiKey } from './falConfig'

const TOPAZ_IMAGE_MODEL = 'fal-ai/topaz/upscale/image' as const

/** UHD 4K width (16:9 → 2160p height at correct aspect). */
export const TARGET_4K_WIDTH_PX = 3840

let falConfigured = false

function ensureFalConfigured() {
  if (falConfigured) return
  fal.config({ credentials: getFalApiKey() })
  falConfigured = true
}

function getImageSizeFromBlob(blob: Blob): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const u = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(u)
      resolve({ w: img.naturalWidth, h: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(u)
      reject(new Error('Could not read image dimensions'))
    }
    img.src = u
  })
}

/**
 * One Topaz pass; returns a temporary URL to the enhanced image.
 */
export async function runTopazPass(imageUrl: string, upscaleFactor: number): Promise<string> {
  ensureFalConfigured()
  if (upscaleFactor < 1 || upscaleFactor > 4) {
    throw new Error(`Topaz upscale_factor must be 1–4, got ${upscaleFactor}`)
  }
  const result = await fal.subscribe(TOPAZ_IMAGE_MODEL, {
    input: {
      image_url: imageUrl,
      model: 'Standard V2',
      upscale_factor: upscaleFactor,
      output_format: 'png',
      subject_detection: 'All',
      face_enhancement: true,
      face_enhancement_strength: 0.8,
    },
  })
  const url = (result as { data?: { image?: { url?: string } } }).data?.image?.url
  if (!url) {
    throw new Error('Topaz returned no image URL in the response')
  }
  return url
}

export async function uploadBlobForFal(blob: Blob, filename: string): Promise<string> {
  ensureFalConfigured()
  const file = new File([blob], filename, { type: blob.type || 'image/png' })
  return fal.storage.upload(file)
}

/**
 * Chains Topaz (factors 1–4 per pass) until the image is at least `targetWidthPx` wide.
 */
export async function upscaleToTargetWidthFromBlob(
  sourceBlob: Blob,
  targetWidthPx: number,
  options?: { signal?: AbortSignal; onProgress?: (message: string) => void }
): Promise<{ arrayBuffer: ArrayBuffer; mime: string; width: number; height: number; passes: number }> {
  const signal = options?.signal
  const onProgress = options?.onProgress

  if (targetWidthPx < 1) {
    throw new Error(`targetWidthPx must be positive, got ${targetWidthPx}`)
  }

  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }

  const name = 'source.png'
  onProgress?.('Uploading to fal for Topaz…')
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }
  let imageUrl = await uploadBlobForFal(sourceBlob, name)

  const dims0 = await getImageSizeFromBlob(sourceBlob)
  let w = dims0.w
  let h = dims0.h
  let passes = 0
  const maxPasses = 8

  while (w < targetWidthPx * 0.99 && passes < maxPasses) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }
    const factor = Math.min(4, targetWidthPx / w)
    if (factor < 1.001) {
      break
    }
    const f = Math.round(factor * 100) / 100
    passes += 1
    onProgress?.(`Topaz pass ${passes} (×${f}, ${w}→${Math.round(w * f)}px wide)…`)
    imageUrl = await runTopazPass(imageUrl, f)
    w = Math.round(w * f)
    h = Math.round(h * f)
  }

  onProgress?.('Downloading result…')
  const res = await fetch(imageUrl, { signal })
  if (!res.ok) {
    let extra = ''
    try {
      const t = await res.clone().text()
      const s = t.trim().slice(0, 400)
      if (s) extra = ` — ${s}`
    } catch {
      /* ignore */
    }
    throw new Error(`Failed to download upscaled image: ${res.status} ${res.statusText || '(no status text)'}${extra}`)
  }
  const arrayBuffer = await res.arrayBuffer()
  const mime = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/png'

  onProgress?.('Done')
  return { arrayBuffer, mime, width: w, height: h, passes }
}

/**
 * Chains Topaz with factors ≤4 until the image is at least `TARGET_4K_WIDTH_PX` wide
 * (or another pass would not be meaningful).
 */
export async function upscaleTo4KFromBlob(
  sourceBlob: Blob,
  options?: { signal?: AbortSignal; onProgress?: (message: string) => void }
): Promise<{ arrayBuffer: ArrayBuffer; mime: string; width: number; height: number; passes: number }> {
  return upscaleToTargetWidthFromBlob(sourceBlob, TARGET_4K_WIDTH_PX, options)
}
