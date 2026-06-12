/**
 * Fal.ai (Topaz) — key from `_local/.env` as `FAL_API_KEY` (injected in `vite.config.ts`).
 */
export function getFalApiKey(): string {
  const k = import.meta.env.FAL_API_KEY?.trim()
  if (!k) {
    throw new Error(
      'Missing FAL_API_KEY. Add FAL_API_KEY=your_key to _local/.env and restart the dev server.'
    )
  }
  return k
}
