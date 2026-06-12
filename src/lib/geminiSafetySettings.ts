import { HarmBlockThreshold, HarmCategory, type SafetySetting } from '@google/generative-ai'

/**
 * Slightly looser than API defaults: only block when the model is highly confident, which can
 * reduce false positives (e.g. outdoor / swim scenes). It does not override all Google policy:
 * some prompts or image types (e.g. minors) may still be blocked regardless.
 */
const RELAXED: SafetySetting[] = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
]

/**
 * - `default` (or unset): use Generative Language API default thresholds.
 * - `relaxed`: apply {@link RELAXED} to vibe and batch image calls.
 */
export function getOptionalGeminiSafetySettings(): SafetySetting[] | undefined {
  const mode = import.meta.env.VITE_GEMINI_SAFETY_MODE?.trim().toLowerCase()
  if (mode === 'relaxed') {
    return RELAXED
  }
  return undefined
}
