/**
 * Build a `blob:` URL for an API inline image (base64 + mime) for in-app preview.
 * Caller must `URL.revokeObjectURL` when the URL is no longer needed.
 */
export function createObjectUrlFromBase64Image(base64: string, mimeType: string): string {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: mimeType })
  return URL.createObjectURL(blob)
}
