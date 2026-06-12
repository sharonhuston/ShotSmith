/**
 * Central Gemini model ids. Vibe uses text+vision Pro; batch frames use Gemini "Pro Image" (Nano Banana Pro).
 * @see https://ai.google.dev/gemini-api/docs/image-generation
 */

/** Default for style-anchor / vibe parse (text + vision). @see https://ai.google.dev/gemini-api/docs/models */
export const DEFAULT_GEMINI_VIBE_MODEL = 'gemini-3.1-pro-preview'

/**
 * Default for generated stills: Gemini 3 Pro Image (Nano Banana Pro). Not the same id as vibe — image
 * models are image-native. Override with `VITE_GEMINI_IMAGE_MODEL` if needed.
 */
export const DEFAULT_GEMINI_IMAGE_MODEL = 'gemini-3-pro-image-preview'

export function getGeminiApiKey(): string {
  const k = import.meta.env.VITE_GEMINI_API_KEY?.trim()
  if (!k) {
    throw new Error(
      'Missing VITE_GEMINI_API_KEY. Copy _local/.env.example to _local/.env, uncomment VITE_GEMINI_API_KEY=your_key, restart npm run dev.'
    )
  }
  return k
}

export function getVibeModelId(): string {
  return import.meta.env.VITE_GEMINI_MODEL?.trim() || DEFAULT_GEMINI_VIBE_MODEL
}

/** Model id for batch image generation (Pro image pipeline). */
export function getImageGenerationModelId(): string {
  return import.meta.env.VITE_GEMINI_IMAGE_MODEL?.trim() || DEFAULT_GEMINI_IMAGE_MODEL
}
