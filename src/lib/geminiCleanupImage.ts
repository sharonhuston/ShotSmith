import { getGeminiApiKey, getImageGenerationModelId } from './geminiConfig'
import { getOptionalGeminiSafetySettings } from './geminiSafetySettings'
import { prepareImageForGemini } from './prepareImageForGemini'

export type CleanupPresetId = 'vintage' | 'balanced' | 'clarity'

export const CLEANUP_PRESET_LIST: { id: CleanupPresetId; label: string; hint: string }[] = [
  {
    id: 'vintage',
    label: 'Vintage-faithful',
    hint: 'Gentle fixes; keep period color and mood lighting.',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    hint: 'Default: clearer image without a heavy re-grade.',
  },
  {
    id: 'clarity',
    label: 'More clarity',
    hint: 'Stronger cleanup for noise/specks; still no new content.',
  },
]

const PRESET_LINES: Record<CleanupPresetId, { line: string; temperature: number }> = {
  vintage: {
    line:
      'Restoration style: be conservative. Prioritize the photo’s period look and any intentional warm or cool "vintage" lighting—refine, do not re-grade to a flat modern look.',
    temperature: 0.28,
  },
  balanced: {
    line: 'Restoration style: balanced—clear improvement without a heavy-handed reimagining of the image.',
    temperature: 0.4,
  },
  clarity: {
    line:
      'Restoration style: push a bit more for legibility, perceived sharpness, and cleanliness where needed, but never invent or hallucinate new objects, faces, or text.',
    temperature: 0.52,
  },
}

function buildCleanupPrompt(preset: CleanupPresetId): string {
  const extra = PRESET_LINES[preset].line
  return [
    'You are restoring a single photograph (Nano Banana / Pro Image). Output exactly one image that matches the input scene and content.',
    'The input may be an old, faded, soft-focus, or noisy photograph: improve apparent sharpness carefully, clean dust and small speckles, reduce excessive grain/noise, and make contrast and light levels more natural where they are clearly failing.',
    'Preserve the overall color character: keep appealing vintage or period-appropriate color and lighting when it reads as intentional. Do not strip away "cool" mood lighting unless the image is clearly broken.',
    'Do not add people, text, or objects. Do not recompose or crop. Do not change the main subject. Output a single high-quality still image that still feels like the same photo, only in better condition.',
    extra,
    'Return the result as the image output only.',
  ].join('\n')
}

type Extracted = { base64: string; mimeType: string }

function extractImagePart(json: unknown): Extracted {
  const j = json as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { data?: string; mimeType?: string }
          inline_data?: { data?: string; mime_type?: string }
        }>
      }
    }>
  }
  const parts = j.candidates?.[0]?.content?.parts
  if (!parts?.length) {
    throw new Error('Cleanup: API returned no candidates. The request may have been blocked or the model failed.')
  }
  for (const p of parts) {
    const id = p.inlineData ?? p.inline_data
    if (id?.data) {
      const withMime = id as { data: string; mimeType?: string; mime_type?: string }
      const mimeType = withMime.mimeType ?? withMime.mime_type ?? 'image/png'
      return { base64: withMime.data, mimeType }
    }
  }
  throw new Error('Cleanup: no image data in the response.')
}

/**
 * One-shot "cleanup" with Gemini 3 Pro Image (Nano Banana Pro): same model path as batch stills.
 */
export async function generateCleanupImageBase64(options: {
  referenceFile: File
  preset: CleanupPresetId
  signal?: AbortSignal
}): Promise<{ base64: string; mimeType: string }> {
  const apiKey = getGeminiApiKey()
  const model = getImageGenerationModelId()
  const prepared = await prepareImageForGemini(options.referenceFile, { signal: options.signal })
  const prompt = buildCleanupPrompt(options.preset)
  const t = PRESET_LINES[options.preset].temperature
  const safetySettings = getOptionalGeminiSafetySettings()
  const body: Record<string, unknown> = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: prepared.mimeType, data: prepared.base64 } },
        ],
      },
    ],
    // Note: Do not set generationConfig.mediaResolution here. The Pro Image model
    // (e.g. gemini-3-pro-image-preview) returns 400 INVALID_ARGUMENT with that field.
    // Input sizing/quality is handled client-side in prepareImageForGemini.
    generationConfig: {
      temperature: Math.max(0, Math.min(1, t)),
    },
  }
  if (safetySettings?.length) {
    body.safetySettings = safetySettings
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: options.signal,
  })

  const rawText = await res.text()
  if (!res.ok) {
    throw new Error(
      `[Cleanup] model "${model}": request failed (${res.status}): ${rawText.slice(0, 1200)}`
    )
  }
  let json: unknown
  try {
    json = JSON.parse(rawText) as unknown
  } catch {
    throw new Error('Cleanup: API returned non-JSON.')
  }
  const r = extractImagePart(json)
  return { base64: r.base64, mimeType: r.mimeType }
}

/** API inline image data → ArrayBuffer for saving. */
export function decodeImageBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const bin = atob(base64)
  const n = bin.length
  const u = new Uint8Array(n)
  for (let i = 0; i < n; i++) u[i] = bin.charCodeAt(i)
  return u.buffer
}
