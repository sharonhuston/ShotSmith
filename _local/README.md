# `_local/` — not for GitHub

Put **machine-specific** files here. The whole folder is gitignored except this README and `.env.example`.

| File | Purpose |
|------|---------|
| **`.env`** | Your API keys (copy from `.env.example`, then uncomment and fill in). |
| **`Launch ShotSmith.lnk`** | Windows shortcut with the custom icon (created by `Launch ShotSmith.bat` or `Create Launcher Shortcut.bat`). |
| **`notes.txt`** | Optional personal scratch notes. |
| **`ShotSmith_original_art.png`** | Optional source art / exports you do not want in the repo. |

**Setup (every new clone):**

1. Copy `.env.example` → `.env` in this folder.
2. Uncomment and paste your API keys.
3. Restart `npm run dev` after any change.
4. **Windows only:** Run `Launch ShotSmith.bat` once (or `Create Launcher Shortcut.bat`) to create `Launch ShotSmith.lnk` here.

**Do not commit** `.env`, `.lnk`, or other private files from this folder. Git only tracks `README.md` and `.env.example` in `_local/`.

See [USER_GUIDE.md](../USER_GUIDE.md#the-_local-folder) and [README.md](../README.md#what-goes-on-github).
