/**
 * Target size for **model outputs** in the batch (not the reference, not the vibe step).
 * Small “contact sheet” size for fast iteration; pick keepers, then upscale in Topaz, Nano, etc.
 */
export const GENERATED_OUTPUT = {
  widthPx: 500,
  /** 16:9, matches typical video stills */
  aspect: { w: 16, h: 9 },
} as const

export function generatedOutputHeightPx(): number {
  return Math.round(
    (GENERATED_OUTPUT.widthPx * GENERATED_OUTPUT.aspect.h) / GENERATED_OUTPUT.aspect.w
  )
}
