/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google AI Studio API key for Gemini (Vite exposes only vars prefixed with VITE_). */
  readonly VITE_GEMINI_API_KEY: string | undefined
  /** Vibe + style anchor (default: gemini-3.1-pro-preview in code). */
  readonly VITE_GEMINI_MODEL: string | undefined
  /** Batch image generation; default: gemini-3-pro-image-preview (Nano Banana Pro) in code. */
  readonly VITE_GEMINI_IMAGE_MODEL: string | undefined
  /** Vibe + batch: `relaxed` = BLOCK_ONLY_HIGH on standard harm categories; unset = API defaults. */
  readonly VITE_GEMINI_SAFETY_MODE: string | undefined
  /** fal.ai (Topaz); from `_local/.env` — see `vite.config.ts`. */
  readonly FAL_API_KEY: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
