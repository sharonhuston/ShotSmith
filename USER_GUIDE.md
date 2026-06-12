# ShotSmith — User guide

ShotSmith is a **local app** you run on your own computer: add your API keys, open it in a browser, and build a **matching set of cinematic stills from one reference image**—for storyboards, AI video frame prep, and shot planning. Pick your shots, review previews in the gallery, and upscale the frames you want to keep.

For install commands and troubleshooting, see [README.md](README.md). For product direction, see [roadmap.md](roadmap.md). **License:** MIT — copyright **ShotSmith Contributors** (see [LICENSE](LICENSE)). **Secrets and shortcuts:** [`_local/`](_local/README.md) — not uploaded to GitHub.

---

## Quick start

1. Install **Node.js** LTS and clone or download this repo.
2. In the project root (folder with `package.json`), run `npm install`.
3. Copy **`_local/.env.example`** to **`_local/.env`** (see [**`_local/` folder**](#the-_local-folder)).
4. Uncomment and set at least **`VITE_GEMINI_API_KEY`** (see [Personalization checklist](#personalization-checklist)).
5. Start the app:
   - **macOS / Linux:** `npm run dev` in the project root.
   - **Windows:** see [Windows: create the launcher shortcut](#windows-create-the-launcher-shortcut-one-time) (one-time), then use **`_local/Launch ShotSmith.lnk`** or **`Launch ShotSmith.bat`**.
6. Open the URL shown in the terminal (usually http://localhost:5173/).
7. Upload a reference image, wait for the style anchor, pick shots, choose an output folder, and run **Batch generate**.

Restart the dev server after any change to **`_local/.env`** (`Ctrl+C`, then `npm run dev` again).

---

## The `_local/` folder

GitHub gets the app source and docs—not your keys, shortcuts, or scratch files. Put those in **`_local/`**:

| File | In Git? | Purpose |
|------|---------|---------|
| [`_local/README.md`](_local/README.md) | Yes | Explains this folder |
| [`_local/.env.example`](_local/.env.example) | Yes | Template (comments only) |
| **`_local/.env`** | No | Your API keys |
| **`_local/Launch ShotSmith.lnk`** | No | Windows shortcut with custom icon |
| **`ShotSmith_original_art.png`** (example) | No | Large source art; keep here instead of the repo root |
| Other files you add | No | e.g. `notes.txt`, exports |

The in-app/browser icon uses **`public/ShotSmith.ico`** (committed). That is separate from files you store only under `_local/`.

Root [`.env.example`](.env.example) only points here—do not put secrets in the project root.

---

## Personalization checklist

Use this when setting up a new machine or onboarding someone else. These are the items **every user** needs before the app can run. Secrets go in **`_local/.env` only** (see `_local/.env.example`—never commit real keys).

| What | Where | What you do |
|------|--------|-------------|
| **Google Gemini API key** | `_local/.env` → `VITE_GEMINI_API_KEY` | Create a key in [Google AI Studio](https://aistudio.google.com/apikey). Copy `_local/.env.example` → `_local/.env`, uncomment this line, paste your key, restart `npm run dev`. |
| **Generative Language API** | Google Cloud project tied to that key | If you see 403 / “API not enabled”, enable **Generative Language API** in [Google Cloud Console](https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com), wait a few minutes, retry. |
| **fal.ai API key** | `_local/.env` → `FAL_API_KEY` | **Only if you use Solo Upscale.** Key from [fal.ai dashboard](https://fal.ai/dashboard/keys). Uncomment in `_local/.env` and restart the dev server. |
| **Browser** | Chrome or Edge recommended | Needed for the **output folder** picker (File System Access). Firefox has limited support. |
| **Network** | Firewall / corporate proxy | Allow the browser to reach `generativelanguage.googleapis.com`. For Solo Upscale, allow fal.ai as well. |
| **Windows launcher shortcut** | `_local/Launch ShotSmith.lnk` (not in the download) | **One-time per PC** — see [below](#windows-create-the-launcher-shortcut-one-time). The `.bat` works without it; the `.lnk` adds the custom icon. |

Everything else—output folder, filename prefix, shot selection—is chosen **in the app** each time you generate. Defaults work out of the box (prefix starts as `ShotSmith`).

---

## Windows: create the launcher shortcut (one-time)

If you **clone or download** ShotSmith from GitHub, you get **`ShotSmith.ico`** and **`Launch ShotSmith.bat`**, but **not** **`_local/Launch ShotSmith.lnk`**. That shortcut is created on **your** PC inside gitignored **`_local/`**.

**You only need to do this once** per machine (or again if you move the project folder):

| Step | Action |
|------|--------|
| 1 | Open the project folder (where `package.json` and `ShotSmith.ico` live). |
| 2 | Double-click **`Launch ShotSmith.bat`** once — it runs `npm run dev` and, if `_local/Launch ShotSmith.lnk` is missing, creates it automatically. |
| **Or** | Double-click **`Create Launcher Shortcut.bat`** to create only the shortcut (no dev server). |
| 3 | From then on, open **`_local/Launch ShotSmith.lnk`** in Explorer for the branded icon (it still runs the same `.bat`). |

**Without the shortcut:** **`Launch ShotSmith.bat`** always works; it just shows the generic batch-file icon in Explorer.

**Why:** Windows cannot attach a custom icon to a `.bat` file. The `.lnk` in `_local/` points at the bat and uses **`ShotSmith.ico`** for the icon.

**Recreate after moving the folder:** Run **`Create Launcher Shortcut.bat`** again, or delete `_local/Launch ShotSmith.lnk` and run **`Launch ShotSmith.bat`** once.

---

## Optional: `_local/.env` overrides

You only need these if defaults fail (model 404) or you want different safety behavior. Uncomment in `_local/.env` and restart the dev server.

| Variable | Default (in code) | When to change |
|----------|-------------------|----------------|
| `VITE_GEMINI_MODEL` | `gemini-3.1-pro-preview` | Vibe parse errors with “model not found”. |
| `VITE_GEMINI_IMAGE_MODEL` | `gemini-3-pro-image-preview` | Batch/cleanup needs a different **image-output** model. |
| `VITE_GEMINI_SAFETY_MODE` | (strict) | Set to `relaxed` only if you understand fewer false blocks; policy limits still apply. |

See [README.md — Environment variables](README.md#environment-variables) for the full list.

---

## Optional: changing defaults in code

**Most users never need this.** Edit and rebuild only if you want to change what ships in the repo.

| File | What it controls | Change when… |
|------|------------------|--------------|
| `src/lib/shotPacks.ts` | Shot tabs, labels, and `presetPrompt` text sent to Gemini | You update the [Cinematic Shot Types](https://docs.google.com/spreadsheets/d/1MFsHt3Eg6awUQG0qLHYObWtOcj95E3uMclVZHLmJKdc/edit) matrix and want the app to match. |
| `src/lib/generatedFrameSize.ts` | Batch output width/aspect (default 500px wide, 16:9) | You want faster/cheaper previews or a different aspect ratio before external upscale. |
| `src/App.tsx` → `SOLO_UPSCALE_PRESETS` | Width buttons on Solo Upscale | Your usual export widths aren’t in the built-in list. |
| `src/App.tsx` → `DEFAULT_PROJECT` | Initial **filename prefix** in the UI | You want a different default than `ShotSmith`. |
| `src/App.tsx` → output folder hint text | Example line under “Select output folder” | Cosmetic only; change if you want different helper copy. |

**Production build (`dist/`):** If you run `npm run build` and ship the `dist/` folder, Vite embeds `VITE_*` and `FAL_API_KEY` at **build** time—set env in `_local/.env` on the build machine, and remember keys end up in the client bundle (local use only). Day-to-day use is `npm run dev` + `_local/.env`.

---

## Optional: local paths (Windows)

The repo ships **without** your drive letters or usernames. Nothing in Git should point at `C:\Users\...` or OneDrive paths.

| What | Where | Notes |
|------|--------|--------|
| **Project folder** | Where you clone the repo | `Launch ShotSmith.bat` uses `cd /d "%~dp0"` so it works wherever you put the folder. |
| **Output folder** | App UI each session | You pick the save location in the browser; it is not stored in the repo. |
| **`Launch ShotSmith.bat`** | Project root | Runs `npm run dev`. Optional `REM` lines (Node on `PATH`, etc.) are **commented out**—edit locally only. |
| **`_local/` scratch files** | e.g. `notes.txt`, art exports | Entire folder gitignored except README and `.env.example`. |

Launcher shortcut setup is covered in [Windows: create the launcher shortcut](#windows-create-the-launcher-shortcut-one-time).

---

## Step-by-step: `_local/.env` setup

1. Copy `_local/.env.example` to `_local/.env`.
2. Open `_local/.env` in a text editor.
3. Uncomment and fill in:

```env
VITE_GEMINI_API_KEY=your_actual_key_here
```

4. If you use **Solo Upscale**, also uncomment:

```env
FAL_API_KEY=your_fal_key_here
```

5. Save the file and restart `npm run dev`.

**Do not commit `_local/.env`.** The `_local/` folder is gitignored except `README.md` and `.env.example`.

---

## Using the app

### Upload and vibe

1. Open the **Upload** tab.
2. Drop or pick a **PNG** or **JPEG** reference.
3. The app calls Gemini to produce a read-only **style anchor** (you do not type prompts for this step).
4. If parsing fails, read the message in the UI—common fixes are a missing key, wrong model id, or API not enabled.

### Shots and batch

1. Go to **Shots** and check the frames you want from the matrix tabs.
2. Set a **filename prefix** if you don’t want the default `ShotSmith`.
3. Adjust **creativity** (denoising) and **identity lock** if needed.
4. Choose an **output folder** (Chromium directory picker).
5. Click **Batch generate**. Files are written as `ProjectName_pack_shot_#.png` (or `.jpg` per API).

### Gallery, cleanup, upscale

- **Gallery** — preview of the last batch run in the app.
- **Cleanup** — optional Gemini image cleanup presets (same Gemini key and image model as batch).
- **Solo Upscale** — requires **`FAL_API_KEY`**; upscales selected images via fal/Topaz.

---

## Security notes (important for GitHub)

- **Never put real API keys** in `src/`, `README.md`, or the project root. Use **`_local/.env` only**.
- **Before `git push`:** `git status` should not list `_local/.env`, `_local/*.lnk`, or other private files under `_local/`. Only `_local/README.md` and `_local/.env.example` belong in the repo.
- **`VITE_*` variables are visible in the browser** after the dev server or build loads them. Acceptable for **personal local use** only.
- For a shared or public deployment, use a backend or desktop shell (e.g. Electron) so keys are not in the client bundle.
- If a key was ever committed, **rotate it** in Google AI Studio / fal.ai and treat the old key as compromised.

---

## License and redistribution

ShotSmith is **open source** under the [MIT License](LICENSE). Copyright (c) 2026 **ShotSmith Contributors**.

- You may fork, modify, and redistribute the code if you include the MIT license text and copyright notice.
- Forks and derivatives are **not** affiliated with Google, fal.ai, or the original maintainers unless stated otherwise.
- Redistributing the app does **not** grant anyone access to Gemini or fal — recipients still need their own API keys and must follow those services’ terms.

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Missing `VITE_GEMINI_API_KEY` | `_local/.env` exists, line uncommented, dev server restarted. |
| Missing `FAL_API_KEY` | Only needed on Solo Upscale; add to `_local/.env` and restart. |
| 403 / API disabled | Enable Generative Language API for your Google Cloud project. |
| Model 404 | Set `VITE_GEMINI_MODEL` or `VITE_GEMINI_IMAGE_MODEL` to ids your key supports (AI Studio model list). |
| Folder picker missing | Use Chrome or Edge; grant permission. |
| Env changes ignored | Full stop and restart of `npm run dev`. |
| No `_local/Launch ShotSmith.lnk` after download | Normal — the shortcut is not in the repo. Run **`Launch ShotSmith.bat`** once or **`Create Launcher Shortcut.bat`** ([one-time setup](#windows-create-the-launcher-shortcut-one-time)). |
| Shortcut broken after moving project | Delete `_local/Launch ShotSmith.lnk` and run **`Create Launcher Shortcut.bat`** again. |

More detail: [README.md — Troubleshooting](README.md#troubleshooting).

---

## Related docs

| File | Purpose |
|------|---------|
| [README.md](README.md) | Install, Windows launcher, scripts, env variable table, project layout |
| [decisions.md](decisions.md) | Why the stack and APIs were chosen |
| [roadmap.md](roadmap.md) | Shipped vs planned features |
| [_local/README.md](_local/README.md) | What belongs in `_local/` (not for GitHub) |
| [_local/.env.example](_local/.env.example) | Comment-only template for API keys |
| [LICENSE](LICENSE) | MIT — Copyright (c) 2026 ShotSmith Contributors |
