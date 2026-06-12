/**
 * Map Gemini / network failures to short, actionable copy for the UI.
 */

import { ApiError } from '@fal-ai/client'

function formatFalApiError(err: ApiError<unknown>): string {
  const status = err.status
  let head = (err.message ?? '').trim()
  if (!head || /^HTTP \d{3}:\s*$/.test(head)) {
    head = `fal.ai returned HTTP ${status} (the server did not include a status message).`
  }

  const parts: string[] = [head]

  if (err.requestId) {
    parts.push(`fal request id: ${err.requestId}`)
  }

  const body = err.body
  if (body !== undefined && body !== null) {
    if (typeof body === 'string' && body.trim()) {
      parts.push(body.trim().slice(0, 800))
    } else if (typeof body === 'object') {
      const o = body as Record<string, unknown>
      const detail = o.detail
      const msg = o.message
      if (typeof msg === 'string' && msg.trim() && msg.trim() !== head) {
        parts.push(msg.trim().slice(0, 800))
      } else if (typeof detail === 'string' && detail.trim()) {
        parts.push(detail.trim().slice(0, 800))
      } else {
        try {
          const j = JSON.stringify(body)
          if (j && j !== '{}' && j !== 'null') parts.push(j.slice(0, 800))
        } catch {
          /* ignore */
        }
      }
    }
  }

  if (status === 429) {
    parts.push('Rate limited—wait briefly and try again, or check fal.ai usage/quota.')
  } else if (status >= 500) {
    parts.push(
      'Often a temporary upstream issue: retry in a minute. If it persists, try a smaller target width, a smaller source image, or check https://status.fal.ai — include the request id above if you contact support.'
    )
  }

  return parts.join(' ')
}

export function formatVibeParseError(err: unknown): string {
  if (err == null) return 'Vibe parse failed (unknown error).'

  if (err instanceof DOMException && err.name === 'AbortError') {
    return 'Cancelled (a newer request replaced this one).'
  }
  if (err instanceof Error && err.name === 'AbortError') {
    return 'Cancelled (a newer request replaced this one).'
  }

  if (err instanceof ApiError) {
    return formatFalApiError(err)
  }

  const raw = err instanceof Error ? err.message : String(err)
  const m = raw.toLowerCase()

  if (/^HTTP \d{3}:\s*$/.test(raw.trim())) {
    return `${raw.trim()} The server sent no error details. If this was Topaz (fal.ai), wait a minute and retry, or open the browser devtools console (F12) for the full response.`
  }

  if (m.includes('vite_gemini_api_key') && m.includes('missing')) {
    return 'No API key: copy _local/.env.example to _local/.env, add VITE_GEMINI_API_KEY, then restart npm run dev.'
  }

  if (m.includes('invalid') && m.includes('key')) {
    return 'The API key was rejected. Create a new key in Google AI Studio, update _local/.env, and restart the dev server.'
  }

  if (m.includes('403') || m.includes('permission_denied') || m.includes('service_disabled')) {
    if (m.includes('api has not been used') || m.includes('disabled') || m.includes('enable')) {
      return 'The Gemini API is not turned on for this Google Cloud project. Open the link from the error in Google Cloud Console, click Enable, wait a few minutes, and try again.'
    }
    return 'Access denied (403). Check billing, API enablement, and that the key is allowed to call Gemini.'
  }

  if (m.includes('404') && (m.includes('model') || m.includes('not found'))) {
    if (m.includes('[batch image]')) {
      return 'Batch stills: that image model id is not available (404). In _local/.env set VITE_GEMINI_IMAGE_MODEL to a model that supports image output (see Google AI Studio → your key → list models; default in code: gemini-3-pro-image-preview), then restart npm run dev.'
    }
    if (m.includes('[vibe]')) {
      return 'Vibe: that model id is not available (404). In _local/.env set VITE_GEMINI_MODEL to a valid text+vision model (see Google AI Studio; default in code: gemini-3.1-pro-preview), then restart npm run dev.'
    }
    return 'Model not found (404). In _local/.env set VITE_GEMINI_MODEL (vibe) or VITE_GEMINI_IMAGE_MODEL (batch). Use exact ids from Google AI Studio, then restart npm run dev.'
  }

  if (m.includes('429') || m.includes('resource exhausted') || m.includes('quota')) {
    return 'Rate limit or quota hit. Wait a bit, check billing and quotas in Google Cloud, or try again later.'
  }

  if (
    m.includes('safety') ||
    m.includes('blocked') ||
    m.includes('harm') ||
    m.includes('prohibited') ||
    (m.includes('finishreason') && m.includes('safety'))
  ) {
    return 'The request was blocked by safety filters. Google is strict about images that include children or skin tone / swim-style context; you may need a different reference, or a non-Gemini workflow for that asset. Optional: in _local/.env set VITE_GEMINI_SAFETY_MODE=relaxed and restart the dev server (less strict on standard harm categories; some blocks cannot be changed). You can also review Google AI Studio terms for your key.'
  }

  if (m.includes('failed to fetch') || m.includes('network') || m.includes('load failed')) {
    return 'Network error. Check your connection, VPN, and that the browser can reach Google (try another network if on a locked-down Wi‑Fi).'
  }

  if (m.includes('cancelled') || m.includes('aborted')) {
    return 'Request was cancelled.'
  }

  if (raw.length > 800) {
    return `${raw.slice(0, 400)}… (truncated) See the browser dev console (F12) for the full error.`
  }
  return raw
}

export function formatBlockReasonHint(reason: string, safetyMessage?: string): string {
  const r = reason.toUpperCase()
  if (r.includes('SAFETY') || r.includes('BLOCK')) {
    return 'The model refused to describe this image (safety policy). Try another reference or adjust content.'
  }
  if (r.includes('OTHER') && safetyMessage) {
    return `Blocked: ${safetyMessage}`
  }
  return `Blocked (${reason}). Try another image or check Google AI safety settings.`
}
