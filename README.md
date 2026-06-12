# ShotSmith

**One reference image → a matching set of cinematic stills.**

> **Transparency — vibe-coded app:** ShotSmith was built with **AI-assisted development** (primarily [Cursor](https://cursor.com)), under human direction, testing, and product decisions. The source is open; you can read, run, fork, and judge it for yourself. Design rationale is in [decisions.md](decisions.md). If you want a hand-written-only codebase, this project is not that—and we are not pretending otherwise.

ShotSmith is a **local app** for instructional designers, filmmakers, and anyone preparing **AI video or visual story workflows**. Upload a seed image, choose the shots you want, and generate a batch of previews that share the same look—then upscale the frames you need to 4K.

The workflow is a simple wizard: **Select Image** → **Select Shots** → **Gallery**. Two additional tabs offer photo cleanup and solo upscaling for individual files.

| | |
|--|--|
| **Seed-driven** | One reference image anchors style across every shot. |
| **Pick, don't prompt** | Choose shot types and counts from a curated matrix. |
| **Review, then upscale** | Generate previews first; upscale favorites when you're ready. |
| **Runs locally** | Browser UI on your machine; keys and files stay in `_local/` (not on GitHub). |

Also a fit for storyboards, animatics, pitch decks, and first/last frame planning for video clips.

**Stack (for developers):** Vite · React 19 · TypeScript · Google Gemini · optional fal.ai (Topaz upscale).

| Doc | Purpose |
|-----|---------|
| This **README** | Install, run, configure, troubleshoot |
| [**USER_GUIDE.md**](USER_GUIDE.md) | First-time setup, **Windows launcher shortcut** (one-time), personalization checklist |
| [**decisions.md**](decisions.md) | Architecture / product decisions (ADR-style) |
| [**roadmap.md**](roadmap.md) | What’s shipped vs planned |
| [**LICENSE**](LICENSE) | MIT — copyright **ShotSmith Contributors** (2026) |
| [**_local/README.md**](_local/README.md) | Machine-local files (keys, shortcuts) — not for GitHub |

---

## First-time setup (after clone or download)

| Step | Action |
|------|--------|
| 1 | `npm install` in the project root |
| 2 | Copy **`_local/.env.example`** → **`_local/.env`**, uncomment keys ([details](USER_GUIDE.md#step-by-step-_localenv-setup)) |
| 3 | `npm run dev` — or on Windows, **`Launch ShotSmith.bat`** (creates **`_local/Launch ShotSmith.lnk`** on first run) |
| 4 | Open the URL Vite prints (usually http://localhost:5173/) |

**API keys** go in **`_local/.env`** on your machine only—that file is never uploaded to GitHub. See [**Your private files**](#your-private-files) below.

---

## Your private files

When you download or clone ShotSmith from GitHub, you get the app, docs, and launcher scripts. A few things stay **on your PC only**:

| File | What it is |
|------|------------|
| **`_local/.env`** | Your API keys (copy from [`_local/.env.example`](_local/.env.example)) |
| **`_local/Launch ShotSmith.lnk`** | Optional Windows shortcut with the custom icon (created on first run) |
| Anything else you add under **`_local/`** | Notes, source art, scratch files |

That keeps secrets and machine-specific paths off GitHub. Full details: [**`_local/README.md`**](_local/README.md).

**Contributors:** before `git push`, run `git status` and confirm `_local/.env` and other private `_local/*` files (except `README.md` and `.env.example`) are not staged.

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| **Node.js** | LTS (e.g. 20.x or 22.x) — [nodejs.org](https://nodejs.org) |
| **npm** | Comes with Node (use to run scripts below) |
| **Browser** | **Chrome** or **Edge** recommended: **File System Access API** (folder picker) works there; Firefox support is limited |
| **Google account** | For an API key and (if needed) enabling the API in Cloud Console |

---

## Install and run (development)

From the project root (`ShotSmith/`, where `package.json` lives):

```bash
npm install
```

Create **`_local/.env`** by copying [**`_local/.env.example`**](_local/.env.example), then **uncomment** the lines you need and paste your keys (the `_local/` folder is gitignored—see [**`_local/README.md`**](_local/README.md)). At minimum:

```env
# In _local/.env, uncomment:
VITE_GEMINI_API_KEY=your_key_here
```

For **Solo Upscale** (fal/Topaz), also uncomment `FAL_API_KEY` in `_local/.env`. See [**USER_GUIDE.md**](USER_GUIDE.md) for the full personalization checklist.

Optional — override the default **models** (uncomment in `_local/.env`; see table below):

```env
# VITE_GEMINI_MODEL=gemini-3.1-pro-preview
# VITE_GEMINI_IMAGE_MODEL=gemini-3-pro-image-preview
```

Get a key: [Google AI Studio](https://aistudio.google.com/apikey).

If you see **403** / “API has not been used” / “disabled”, enable **Generative Language API** for the Google Cloud project tied to that key — the error often includes a direct link to the right Console page.

Start the dev server:

```bash
npm run dev
```

Open the URL Vite prints (usually **http://localhost:5173/**). If that port is busy, Vite may use **5174** or another port.

### Windows launcher (download / clone)

The repo includes **`ShotSmith.ico`** and **`Launch ShotSmith.bat`**. It does **not** include **`_local/Launch ShotSmith.lnk`** (shortcuts use machine-specific paths; they live in gitignored **`_local/`**).

**Every Windows user, once per PC:**

1. After `npm install` and **`_local/.env`** setup, double-click **`Launch ShotSmith.bat`** once (starts the dev server and creates **`_local/Launch ShotSmith.lnk`** if missing), **or** run **`Create Launcher Shortcut.bat`** to create only the shortcut.
2. Use **`_local/Launch ShotSmith.lnk`** afterward for the custom icon in Explorer (optional — the `.bat` always works).

Full steps: [USER_GUIDE.md — Windows: create the launcher shortcut](USER_GUIDE.md#windows-create-the-launcher-shortcut-one-time).

**Important:** after changing **`_local/.env`**, stop the server (`Ctrl+C`) and run `npm run dev` again. Vite reads env only at startup.

### Other scripts

| Command | What it does |
|---------|----------------|
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run preview` | Serves the `dist/` build locally (for smoke-testing production output) |
| `npm run lint` | Runs ESLint on the project |

---

## How to use the app (current behavior)

1. **Reference image** — Drop or pick a **PNG** or **JPEG**. The app calls Gemini with a high-quality read of the file (see `src/lib/prepareImageForGemini.ts`; very large files may be resampled to fit API limits).  
2. **Style anchor** — Read-only text field fills when **vibe parse** succeeds. This is the global style string; you don’t type it.  
3. **Shot matrix** — Five category tabs; check any shots you want. Data and **prompt suffixes** follow your [Cinematic Shot Types](https://docs.google.com/spreadsheets/d/1MFsHt3Eg6awUQG0qLHYObWtOcj95E3uMclVZHLmJKdc/edit) matrix (`src/lib/shotPacks.ts`).  
4. **Batch controls** — Project name (for filenames), **creativity** (denoising 0–1), **Identity lock** (one shared **batch seed** for every shot in that run when on), and **output folder** (directory picker, Chromium).  
5. **Batch generate** — Calls the **Pro image** model for each selected shot, writes files into the output folder, and logs progress. See `src/lib/geminiImageGeneration.ts`.

**Filename pattern:** `ProjectName_pack_shot_#.png` or `.jpg` (mime from API) — see `src/lib/naming.ts`.

**Planned output pixel size (generation step):** **500px wide**, **16:9** (about **500×281**), defined in `src/lib/generatedFrameSize.ts` for fast review, then **Topaz** / other tools for upscale.

---

## Environment variables

| Variable | Required? | Description |
|----------|-----------|-------------|
| `VITE_GEMINI_API_KEY` | Yes | API key from AI Studio. Set in **`_local/.env`** only; **do not commit** (see `_local/.env.example`). |
| `FAL_API_KEY` | For Solo Upscale | fal.ai key in **`_local/.env`**; injected via `vite.config.ts`. **Do not commit**. |
| `VITE_GEMINI_MODEL` | No | **Vibe** (text+vision) model; default `gemini-3.1-pro-preview`. |
| `VITE_GEMINI_IMAGE_MODEL` | No | **Batch stills** (image output) model; default `gemini-3-pro-image-preview` ( [Nano Banana Pro](https://ai.google.dev/gemini-api/docs/image-generation) ). |
| `VITE_GEMINI_SAFETY_MODE` | No | Set to `relaxed` to use less aggressive blocking on standard harm categories (vibe + batch). **Does not** override all policy (e.g. some images of minors may still be blocked). |

Only names starting with `VITE_` are visible to the browser (Vite embeds them at build time).

---

## Troubleshooting

| Problem | What to try |
|---------|-------------|
| “Missing VITE_GEMINI_API_KEY” | Copy `_local/.env.example` → `_local/.env`, add the key, **restart** `npm run dev`. |
| 403 / API disabled for project | Open the link in the error (or Google Cloud → APIs & Services → enable **Generative Language API**), wait a few minutes, retry. |
| “Directory picker” / folder not working | Use **Chrome** or **Edge**; grant permission when prompted. |
| Styles/env not updating | Full restart of `npm run dev` after `_local/.env` changes. |
| Port already in use | Vite will try the next port; use the URL shown in the terminal. |
| No `_local/Launch ShotSmith.lnk` in downloaded repo | Expected. Run **`Launch ShotSmith.bat`** once or **`Create Launcher Shortcut.bat`** — see [Windows launcher](USER_GUIDE.md#windows-create-the-launcher-shortcut-one-time). |

---

## Project layout (source)

```text
src/
  main.tsx
  App.tsx                # Main UI, state, batch handoff
  App.css
  index.css
  lib/
    geminiConfig.ts       # Default model ids (vibe + image)
    vibeParser.ts         # Gemini → style anchor
    geminiImageGeneration.ts # REST: Pro image model → frame
    savePngToDirectory.ts # Write files via directory handle
    prepareImageForGemini.ts
    shotPacks.ts
    buildBatchJobs.ts
    identityLock.ts
    generatedFrameSize.ts
    naming.ts
    pickOutputDirectory.ts
  vite-env.d.ts
_local/                          # Gitignored except README + .env.example (secrets, .lnk, scratch)
public/ShotSmith.ico             # Browser tab icon (copy of root .ico)
ShotSmith.ico                    # App icon (Windows shortcut; also in public/)
Launch ShotSmith.bat             # Windows dev launcher (in repo)
Create Launcher Shortcut.bat     # One-time: create _local/*.lnk with icon
scripts/Create-LauncherShortcut.ps1
```

---

## Security and production

- **Secrets live in `_local/.env` only** — see [Your private files](#your-private-files).
- **API keys in the client:** Anything in `VITE_*` is bundled for the browser. Fine for **local** use. For anything public or multi-user, use a small **backend** or **Electron** so keys are not in the client.
- **Production build:** `npm run build` outputs to `dist/`. Vite reads **`_local/.env`** (and legacy root `.env` if present) at build time. Hosting `dist/` still exposes inlined keys—local use only unless you add a backend.

---

## License

Copyright (c) 2026 **ShotSmith Contributors**. This project is licensed under the [MIT License](LICENSE).

You may use, copy, modify, merge, publish, distribute, sublicense, and sell copies of the software, subject to the conditions in `LICENSE` (including keeping the copyright notice and license text in redistributions).

**Third-party services:** ShotSmith calls Google Gemini, fal.ai (optional upscale), and other npm dependencies. Each has its own license and terms of use. You still need your own API keys and must comply with those providers’ policies.

**AI-assisted development:** Much of the source was written with AI tooling (Cursor). The MIT license applies to the code as published in this repository.
