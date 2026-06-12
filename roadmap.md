# Roadmap

Living backlog for **ShotSmith**: what’s true today, what to build next, and nice-to-haves. Update this when priorities or scope change. **Rationale and tradeoffs** for past choices live in [decisions.md](decisions.md).

---

## Current release (what works in the app)

- [x] **Shell** — Vite + React 19 + TypeScript, ESLint, production build.  
- [x] **Reference** — Upload PNG/JPEG, preview, file metadata.  
- [x] **Vibe parse** — `parseVibeFromImage`: default `gemini-3.1-pro-preview` (`VITE_GEMINI_MODEL`). High-res path in `prepareImageForGemini.ts`.  
- [x] **Batch image generation** — `geminiImageGeneration.ts` + `savePngToDirectory.ts`: default **Pro image** `gemini-3-pro-image-preview` (`VITE_GEMINI_IMAGE_MODEL`), reference + prompt per job, files to chosen folder.  
- [x] **Shot matrix** — Five tabs (Cinematic, Detail, Context, Pedagogy, Technical); rows and `presetPrompt` suffixes in `shotPacks.ts`.  
- [x] **Identity lock** — Toggle; when on, one `batchSeed` per **Batch generate** click, same value on every `BatchJob` (`buildBatchJobs.ts`, `identityLock.ts`).  
- [x] **Batch controls** — Project name, denoising slider, folder picker (File System Access), **Batch generate** log (jobs, names, seed, **planned 500×16:9** line).  
- [x] **Naming helper** — `buildOutputFilename` in `naming.ts`.  
- [x] **Last-batch gallery** — Thumbnails of the most recent **Batch generate** in “Generated frames (preview)”.  
- [x] **Docs** — `README.md`, `USER_GUIDE.md`, `decisions.md`, `LICENSE` (MIT), `_local/` for gitignored machine files, this file.  

**Not done yet:** one-click path to **Topaz** / “open output folder,” optional client **resize** to 500px.

---

## Next milestone — polish

| # | Task | Notes |
|---|------|--------|
| 1 | **Gallery** | [x] Thumbnails of last batch in the app. |
| 2 | **Cancel** | [x] Abort in-flight batch / upscale / solo runs; keeps session and completed images. |
| 3 | **Resize** (optional) | Canvas to exact 500px width if API returns larger images. |
| 4 | **Error handling** | Optional: skip one failed job vs stop whole batch. |

---

## Milestone after that — “Review and upscale path”

| Task | Notes |
|------|--------|
| **Gallery** | Show thumbnails of the last batch (or folder scan); multi-select. |
| **Export list** | Copy paths or a simple manifest for **Topaz** / **Nano** / other upscalers. |
| **Optional** | “Open in Explorer” for the output folder. |

---

## Polish and reliability (anytime)

- Progress bar and [x] **Cancel** for long batches (batch, gallery upscale, solo upscale, cleanup).  
- [x] **Re-run vibe** without re-uploading the same file.  
- [x] Friendlier **Gemini errors** (403, model not found, safety, network) via `vibeErrors.ts`.  
- [x] `AbortController` + request id for vibe: new file or re-run cancels the in-flight parse so results don’t get mixed up.  
- **Deterministic** optional seed (hash reference + project name) for reproducible runs.    

---

## Optional platform work

- **Electron** (or Tauri) — key not in the browser bundle; native file dialogs; easier automation.  
- **AHK** (Windows) — hotkeys and orchestration *outside* this repo; document in README when relevant.  
- **CSV import** for `shotPacks` so the shot list can be edited without a code change.  

---

## Documentation screenshots

Tracked images for [SETUP_GUIDE.md](SETUP_GUIDE.md) and [USER_GUIDE.md](USER_GUIDE.md). Sources and filenames: [`docs/images/README.md`](docs/images/README.md).

| Task | Status | Notes |
|------|--------|--------|
| **Workflow UI** (Select Image, Shots, Gallery, Upscale Only) | [x] | Copied from `_local/LinkedIn Article/` → `docs/images/` |
| **Re-capture with ShotSmith title bar** | [ ] | LinkedIn shots may show early dev window title |
| **Node.js install** | [ ] | Installer screen + `node --version` check |
| **`_local/.env` setup** | [ ] | Notepad with key redacted |
| **Launch / terminal** | [ ] | `Launch ShotSmith.bat` and localhost URL in browser |
| **Cleanup Only tab** | [ ] | No screenshot in LinkedIn folder yet |
| **Google AI Studio / fal.ai** | [ ] | Optional; UI changes often |

---

## “Ideas / parking lot”

- Per-shot strength overrides.  
- Multiple reference images (if the pipeline supports it).  
- Cost estimate before batch.  

---

*Last doc pass: keep in sync with [README](README.md), [USER_GUIDE](USER_GUIDE.md), `_local/`, and code (`generatedFrameSize`, `vibeParser` defaults).*
