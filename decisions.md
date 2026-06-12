# Decisions (ADR-style)

Short-lived notes on **why** the project is shaped the way it is.  
When a decision is superseded, add a new entry; don’t delete history.

Use this format for new entries:

```text
### NNN — Title
**Status:** Proposed | Accepted | Superseded
**Date:** YYYY-MM-DD
**Context:** …
**Decision:** …
**Consequences:** …
```

---

### 001 — Web stack: Vite + React (TypeScript)

**Status:** Accepted  
**Date:** 2026-04-21  

**Context:** Need a local UI for upload, shot matrix, batch controls, and future gallery; comfort with Node tooling was preferred over Python.  

**Decision:** Use Vite, React, and TypeScript; keep most logic in `src/lib/` and the shell in `App.tsx`.  

**Consequences:** Fast iteration; easy path to Electron later for filesystem and API-key handling. Image generation (when added) may call hosted APIs or a local HTTP service from the same UI.  

---

### 002 — Vibe parse: Google Gemini (vision + text)

**Status:** Accepted  
**Date:** 2026-04-22  

**Context:** “Promptless” style anchor from a single reference image; no manual user prompt.  

**Decision:** Use `@google/generative-ai` with a vision-capable model. Default model id: `gemini-3.1-pro-preview` (overridable via `VITE_GEMINI_MODEL`). The Generative Language API must be **enabled** for the Google Cloud project tied to the API key. Shared defaults live in `src/lib/geminiConfig.ts`.  

**Consequences:** API keys in Vite are exposed in the client bundle; acceptable for local dev, not for public production without a backend or Electron.  

---

### 003 — Reference image quality vs planned batch output size

**Status:** Accepted  
**Date:** 2026-04-22  

**Context:** Confusion between “input to analysis” and “size of generated frames.”  

**Decision:**  
- **Vibe / Gemini input:** send high-quality source (`prepareImageForGemini.ts`); resample only if over API-friendly limits (large dimensions or file size).  
- **Batch outputs:** `geminiImageGeneration.ts` + `savePngToDirectory.ts` write images to the user’s folder; target dimensions are described in the prompt (see `generatedFrameSize.ts`); model output resolution may vary.  

**Consequences:** Two different “sizes” in the product; document in README.  

---

### 004 — Shot list in `shotPacks.ts`

**Status:** Accepted  
**Date:** 2026-04-22  

**Context:** The app needs a fixed catalog of cinematic shot types, each with a human label and a short prompt suffix for batch generation.  

**Decision:** Encode categories and rows in `src/lib/shotPacks.ts`; `presetPrompt` is the model-facing suffix merged with the style anchor.  

**Consequences:** Shot changes require editing `shotPacks.ts` or a future import path (CSV, etc.).  

---

### 005 — Identity lock: one batch, one shared seed (when enabled)

**Status:** Accepted  
**Date:** 2026-04-22  

**Context:** Consistency of subject across angles is the main risk; “same person” in OTS vs rear, etc.  

**Decision:** All checked shots in one “Batch generate” run form a single ordered job list; with **Identity lock** on, one `batchSeed` is generated per run and stored on every job. Execution should stay one continuous session; splitting runs undermines the intent.  

**Consequences:** The model + reference + seed still dominate results; the app encodes a consistent *protocol*, not a guarantee.  

---

### 006 — Output folder: File System Access API (Chromium)

**Status:** Accepted  
**Date:** 2026-04-22  

**Context:** User-chosen local directory for future writes.  

**Decision:** Use `showDirectoryPicker` with read/write mode where supported; wrap in `pickOutputDirectory.ts`.  

**Consequences:** Non-Chromium browsers may lack support; Electron remains an option for full Node `fs` access.  

---

### 007 — Default vibe model: `gemini-3.1-pro-preview` (replaces `*-latest` and earlier ids)

**Status:** Superseded by 008 / 009  
**Date:** 2026-04-22  
**Context:** Pro-tier style anchor.  
**Decision:** See **009** for current default strings.  

---

### 008 — Vibe parse UX: abort, human errors, re-run

**Status:** Accepted  
**Date:** 2026-04-22  

**Context:** Raw SDK errors and race conditions when switching images mid-parse.  

**Decision:** `formatVibeParseError` in `vibeErrors.ts` maps common failure modes to short guidance. `App` uses a monotonic request id and `AbortController` so an older `parseVibeFromImage` cannot overwrite state after a newer run starts. A **Re-run vibe** action calls `parseVibeFromImage` again on the current `File`. `vibeParser` checks `promptFeedback` / `candidates` / `finishReason` before reading text.  

**Consequences:** Users see actionable copy; “Retry” is the same control as re-run.  

---

### 009 — Two Gemini Pro surfaces: vibe (3.1 Pro preview) + batch images (3 Pro image)

**Status:** Accepted  
**Date:** 2026-04-22  

**Context:** A single model id cannot serve both “text/vision style summary” and “native image output” in Google’s API; [Nano Banana Pro](https://ai.google.dev/gemini-api/docs/image-generation) uses `gemini-3-pro-image-preview`. The user still wants “Pro for the whole pipeline.”  

**Decision:**  
- `gemini-3.1-pro-preview` — default for **vibe** (`VITE_GEMINI_MODEL` / `getVibeModelId()`).  
- `gemini-3-pro-image-preview` — default for **batch stills** (`VITE_GEMINI_IMAGE_MODEL` / `getImageGenerationModelId()`), via REST in `geminiImageGeneration.ts`.  
Both are overridable in `_local/.env` (see ADR 011). `geminiConfig.ts` centralizes fallbacks.  

**Consequences:** User must have image-capable model enabled for their key; 401/404 on the image model is handled like other API errors.  

---

### 010 — Open source: MIT, ShotSmith Contributors

**Status:** Accepted  
**Date:** 2026-05-28  

**Context:** The release repo is published on GitHub for others to clone and run locally. A permissive license was needed; copyright holder naming should reflect collaborative / AI-assisted authorship rather than a single individual.  

**Decision:** Ship a root **`LICENSE`** (MIT). Copyright line: **Copyright (c) 2026 ShotSmith Contributors**. Document license and third-party API terms in `README.md` and `USER_GUIDE.md`. Set `"license": "MIT"` in `package.json`.  

**Consequences:** Forks may use and modify the code under MIT terms. Google Gemini, fal.ai, and npm packages remain under their own licenses and terms; MIT does not cover API access.  

---

### 011 — Machine-local files in `_local/`

**Status:** Accepted  
**Date:** 2026-05-28  

**Context:** Release on GitHub must not include API keys, Windows shortcuts with absolute paths, or personal assets. Vite traditionally loads `.env` from the project root.  

**Decision:**  
- Add gitignored **`_local/`** with committed **`_local/README.md`** and **`_local/.env.example`** only.  
- Store **`_local/.env`**, **`_local/Launch ShotSmith.lnk`**, and optional scratch (e.g. source art) under `_local/`.  
- **`vite.config.ts`** loads env from project root and `_local/` (`_local` overrides).  
- Root **`.env.example`** points to `_local/`; do not commit root `.env`.  
- **`ShotSmith.ico`** stays at repo root for the shortcut; **`public/ShotSmith.ico`** for the browser favicon.  

**Consequences:** Cloners copy `_local/.env.example` → `_local/.env` and run Windows shortcut setup once. Documented in README and USER_GUIDE.  

---

*Add new decisions below, incrementing the number.*
