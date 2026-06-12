import { GoogleGenerativeAI } from '@google/generative-ai'
import { formatBlockReasonHint } from './vibeErrors'
import { getGeminiApiKey, getVibeModelId } from './geminiConfig'
import { getOptionalGeminiSafetySettings } from './geminiSafetySettings'
import { prepareImageForGemini } from './prepareImageForGemini'

/**
 * Internal “Vibe Parse” — derive a style anchor from the reference image via Gemini vision.
 * Set `VITE_GEMINI_API_KEY` in `_local/.env` (get a key in Google AI Studio). The key is bundled for
 * local dev; for production, prefer a small backend or Electron so the key is not public.
 */
export type VibeParseResult = {
  styleAnchor: string
  notes?: string[]
}

export type VibeParseOptions = {
  signal?: AbortSignal
}

const STYLE_PROMPT = `You are helping build a "style anchor" for a batch of generated video stills.

Look at the attached image. Reply with a single line of text only:
- A comma-separated list of short phrases (5–10 phrases) that describe GLOBAL visual style: medium, palette, line quality, lighting, background treatment, and overall mood.
- Do NOT name people or describe plot. Do NOT include camera / shot / lens directions (no "wide shot", "close-up", etc.). Those are added later per frame.
- Keep it under about 400 characters. No quotes, no markdown, no list bullets.`

function normalizeStyleLine(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function parseVibeFromImage(
  file: File,
  options?: VibeParseOptions
): Promise<VibeParseResult> {
  const modelName = getVibeModelId()
  try {
    const apiKey = getGeminiApiKey()

    const imagePart = await prepareImageForGemini(file, { signal: options?.signal })
    const genAI = new GoogleGenerativeAI(apiKey)
    const safetySettings = getOptionalGeminiSafetySettings()
    const model = genAI.getGenerativeModel(
      safetySettings
        ? { model: modelName, safetySettings }
        : { model: modelName }
    )

    const result = await model.generateContent(
      {
        contents: [
          {
            role: 'user',
            parts: [
              { text: STYLE_PROMPT },
              { inlineData: { mimeType: imagePart.mimeType, data: imagePart.base64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 512,
        },
      },
      { signal: options?.signal }
    )

    const response = result.response
    const pf = response.promptFeedback
    if (pf?.blockReason) {
      const extra = 'blockReasonMessage' in pf ? String((pf as { blockReasonMessage?: string }).blockReasonMessage ?? '') : ''
      throw new Error(formatBlockReasonHint(String(pf.blockReason), extra))
    }

    const candidates = response.candidates
    if (!candidates?.length) {
      throw new Error(
        'Gemini returned no text candidates. The image may have been blocked or the model produced an empty response.'
      )
    }

    const c0 = candidates[0]
    const fr = c0.finishReason
    if (fr != null && fr !== 'STOP' && fr !== 'MAX_TOKENS') {
      throw new Error(
        `Generation stopped (${String(fr)}). Try another reference image or set VITE_GEMINI_MODEL to a different model.`
      )
    }

    let text: string
    try {
      text = response.text()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      throw new Error(
        msg || 'Could not read the model response. The content may have been blocked by safety rules.'
      )
    }
    const styleAnchor = normalizeStyleLine(text)
    if (!styleAnchor) {
      throw new Error(
        'Gemini returned an empty style anchor. Try again, or set VITE_GEMINI_MODEL in _local/.env and restart the dev server.'
      )
    }

    return {
      styleAnchor,
      notes: [`Model: ${modelName}`, imagePart.preparationNote],
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    if (e instanceof Error && e.name === 'AbortError') throw e
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`[Vibe] model "${modelName}": ${msg}`)
  }
}
