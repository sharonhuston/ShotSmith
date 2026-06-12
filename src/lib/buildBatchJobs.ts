import { SHOT_PACKS, shotKey } from './shotPacks'
import type { VibeParseResult } from './vibeParser'

/** Deterministic 32-bit id so repeated shot types in one batch get different “takes” in the prompt. */
export function deriveVariantSeed(
  batchSeed: number | null,
  packId: string,
  shotId: string,
  takeIndex: number
): number {
  const base = batchSeed != null ? String(batchSeed) : 'unlocked'
  const s = `${base}|${packId}|${shotId}|${takeIndex}`
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export type BatchJob = {
  packId: string
  packTitle: string
  shotId: string
  /** Display / filenames (e.g. includes "2/4" when multiple takes). */
  shotLabel: string
  /** Human label for this shot, without the (n/m) take suffix. */
  shotLabelBase: string
  /**
   * 1-based index when the user asked for several takes of this shot (e.g. 2 of 4).
   * Always at least 1.
   */
  takeIndex: number
  /**
   * How many takes were requested for this shot type. 1 = single frame (no “variants” text).
   */
  takeCount: number
  /**
   * Per-take id (hashed from batch seed + pack + shot + take). Fed to the model so
   * parallel takes of the same category are nudged to differ; subject coherence still
   * uses the shared `batchSeed` when identity lock is on.
   */
  variantSeed: number
  /** Merged text your generator will use (style + shot; image + seed applied elsewhere). */
  mergedPrompt: string
  styleAnchor: string
  shotPresetPrompt: string
  /**
   * When identity lock is on, this is the **shared** run id for the whole batch (one continuous
   * run). Repeats of the same shot type additionally use `variantSeed` to ask for different takes.
   * When off, `null`.
   */
  batchSeed: number | null
  identityLock: boolean
}

export type BuildBatchOptions = {
  /** Same seed for every job if true; if false, `batchSeed` should be `null`. */
  identityLock: boolean
  batchSeed: number | null
}

export const MAX_TAKES_PER_SHOT = 10

function takeCountFor(shotTakeCounts: Readonly<Record<string, number>>, k: string): number {
  const raw = shotTakeCounts[k] ?? 0
  return Math.min(MAX_TAKES_PER_SHOT, Math.max(0, Math.floor(raw)))
}

/**
 * Build jobs from per-shot take counts (1–10 each), in pack order then shot order — one batch, one pass.
 * Each take becomes its own `BatchJob` with `takeIndex` / `takeCount` and a distinct `variantSeed`.
 * Omit a key or use 0 to skip that shot.
 */
export function buildBatchJobs(
  shotTakeCounts: Readonly<Record<string, number>>,
  vibe: VibeParseResult,
  options: BuildBatchOptions
): BatchJob[] {
  const out: BatchJob[] = []
  for (const pack of SHOT_PACKS) {
    for (const shot of pack.shots) {
      const k = shotKey(pack.id, shot.id)
      const n = takeCountFor(shotTakeCounts, k)
      if (n <= 0) continue

      const baseMerged = [vibe.styleAnchor, shot.presetPrompt].filter(Boolean).join(' ')
      for (let t = 1; t <= n; t++) {
        const variantSeed = deriveVariantSeed(options.batchSeed, pack.id, shot.id, t)
        const label = n > 1 ? `${shot.label} (${t}/${n})` : shot.label
        out.push({
          packId: pack.id,
          packTitle: pack.title,
          shotId: shot.id,
          shotLabel: label,
          shotLabelBase: shot.label,
          takeIndex: t,
          takeCount: n,
          variantSeed,
          mergedPrompt: baseMerged,
          styleAnchor: vibe.styleAnchor,
          shotPresetPrompt: shot.presetPrompt,
          batchSeed: options.batchSeed,
          identityLock: options.identityLock,
        })
      }
    }
  }
  return out
}
