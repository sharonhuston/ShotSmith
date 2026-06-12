# Security

## Reporting issues

If you find a security problem in ShotSmith itself, please open a [GitHub issue](https://github.com/sharonhuston/ShotSmith/issues) with details. **Do not paste API keys** in issues or comments.

## API keys

ShotSmith is a **local dev app**. API keys belong in **`_local/.env`** on your machine only — never commit that file.

Variables prefixed with `VITE_` (and `FAL_API_KEY`) are bundled into the browser for local use. Treat them as client-side secrets at your own risk.

## Third-party services

Usage of Google Gemini, fal.ai, and other providers is subject to their terms and your own API keys.
