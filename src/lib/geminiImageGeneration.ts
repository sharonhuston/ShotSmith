import type { BatchJob } from './buildBatchJobs'
import { GENERATED_OUTPUT, generatedOutputHeightPx } from './generatedFrameSize'
import { getGeminiApiKey, getImageGenerationModelId } from './geminiConfig'
import { getOptionalGeminiSafetySettings } from './geminiSafetySettings'
import { prepareImageForGemini } from './prepareImageForGemini'

/**
 * Calls the Generative Language API (REST) with the **image** model: reference + prompt → image part.
 * Uses the Pro image model by default (`gemini-3-pro-image-preview`); see `geminiConfig.ts`.
 */

function buildImagePrompt(job: BatchJob, denoising: number): string {
  const w = GENERATED_OUTPUT.widthPx
  const h = generatedOutputHeightPx()
  const lines = [
    'Generate a single cinematic still frame for video production.',
    `Target look: 16:9 aspect ratio, landscape. Preview-sized target about ${w}×${h} pixels (design for later upscaling).`,
    `Shot and style (follow closely): ${job.mergedPrompt}`,
    `Creativity / interpretation strength (0 = stay very close to the reference, 1 = more interpretive): ${denoising.toFixed(2)}.`,
  ]
  if (job.takeCount > 1) {
    lines.push(
      `This is take ${job.takeIndex} of ${job.takeCount} for this shot: ${job.shotLabelBase}.`,
      'The user requested multiple different interpretations of the same shot category. This frame must be clearly different from the other takes: change composition, eye-line, blocking, and background emphasis—still a valid match for the shot type and style, not a near-duplicate or the same layout repeated.',
    )
  }
  if (job.batchSeed != null) {
    if (job.takeCount > 1) {
      lines.push(
        `Identity: keep the same subject/look as the reference. Shared production batch: ${job.batchSeed}. ` +
          `This take is variant ${job.takeIndex}/${job.takeCount} (diversity id ${job.variantSeed})—interpret that id as: generate a new sample, not a copy of a previous take.`,
      )
    } else {
      lines.push(
        `Identity: keep the same subject as the reference image. Batch coherence id: ${job.batchSeed}.`,
      )
    }
  } else if (job.takeCount > 1) {
    lines.push(
      `Diversity: this is take ${job.takeIndex}/${job.takeCount} of this shot type; diversity id ${job.variantSeed}—make it meaningfully different from the other takes.`,
    )
  }
  lines.push('Return the result as the image output.')
  return lines.join('\n')
}

export type GeneratedImageBlob = {
  base64: string
  /** e.g. image/png */
  mimeType: string
}

function extractImagePart(json: unknown): GeneratedImageBlob {
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
    throw new Error('Image API returned no candidates. The request may have been blocked or the model failed.')
  }
  for (const p of parts) {
    const id = p.inlineData ?? p.inline_data
    if (id?.data) {
      const withMime = id as { data: string; mimeType?: string; mime_type?: string }
      const mimeType = withMime.mimeType ?? withMime.mime_type ?? 'image/png'
      return { base64: withMime.data, mimeType }
    }
  }
  throw new Error(
    'No image data in the API response. Try another image model in VITE_GEMINI_IMAGE_MODEL (must support image output).'
  )
}

export type GenerateFrameOptions = {
  referenceFile: File
  job: BatchJob
  denoising: number
  signal?: AbortSignal
}

/** Returns base64 + mime for the first image part in the response. */
export async function generateFrameImageBase64(options: GenerateFrameOptions): Promise<GeneratedImageBlob> {
  const apiKey = getGeminiApiKey()
  const model = getImageGenerationModelId()
  const prepared = await prepareImageForGemini(options.referenceFile, { signal: options.signal })
  const prompt = buildImagePrompt(options.job, options.denoising)

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
    // Note: Do not set generationConfig.mediaResolution — Pro Image models reject it (400).
    // Reference image prep is in prepareImageForGemini.
    generationConfig: {
      temperature: Math.max(0, Math.min(1, options.denoising)),
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
      `[Batch image] model "${model}": request failed (${res.status}): ${rawText.slice(0, 1200)}`
    )
  }

  let json: unknown
  try {
    json = JSON.parse(rawText) as unknown
  } catch {
    throw new Error('Image API returned non-JSON response.')
  }

  return extractImagePart(json)
}
