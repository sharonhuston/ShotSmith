/** Map API image mime to a short file extension. */
export function extensionForImageMime(mime: string): 'png' | 'jpg' {
  const m = mime.toLowerCase()
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg'
  return 'png'
}

/** File-safe segment for `ProjectName` / `ShotType`. */
export function slugSegment(s: string, fallback: string): string {
  const t = s
    .trim()
    .replace(/[^\p{L}\p{N}\s_-]+/gu, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  return t || fallback
}

/**
 * `[ProjectName]_[ShotType]_[Iteration].[ext]`
 * ShotType: pack id + shot id keeps names stable and unique.
 */
export function buildOutputFilename(
  projectName: string,
  packId: string,
  shotId: string,
  iteration: number,
  ext: 'png' | 'jpg' = 'png'
): string {
  const p = slugSegment(projectName, 'project')
  const shot = slugSegment(`${packId}_${shotId}`, 'shot')
  const n = Math.max(0, Math.floor(iteration))
  return `${p}_${shot}_${n}.${ext}`
}

/**
 * `stem_upscale.png` / `stem_cleanup.png` and numbered variants. Use with
 * `firstAvailableNumberedName` in `savePngToDirectory` to skip existing files.
 */
export function buildSoloOutputName(
  originalStem: string,
  ext: 'png' | 'jpg',
  index: number,
  kind: 'upscale' | 'cleanup'
): string {
  if (index === 0) {
    return `${originalStem}_${kind}.${ext}`
  }
  return `${originalStem}_${kind}_${index + 1}.${ext}`
}

export function buildUpscaleSaveName(originalStem: string, ext: 'png' | 'jpg', index: number): string {
  return buildSoloOutputName(originalStem, ext, index, 'upscale')
}

/** Inserts `_upscale` before the file extension, e.g. `a_b_1.png` → `a_b_1_upscale.png` */
export function upscaledFilenameFromOriginal(originalFilename: string): string {
  const m = /^(.*)(\.[^.]+)$/.exec(originalFilename.trim())
  if (m) {
    return `${m[1]}_upscale${m[2]}`
  }
  return `${originalFilename}_upscale`
}
