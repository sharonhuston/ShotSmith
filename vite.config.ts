import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const root = process.cwd()
  const localDir = path.join(root, '_local')
  // Root .env supported for older setups; _local/.env overrides.
  // _local/.env is the primary secrets file; root .env remains for legacy setups.
  const env = { ...loadEnv(mode, root, ''), ...loadEnv(mode, localDir, '') }
  return {
    // Vite only auto-exposes import.meta.env.VITE_* from envDir — must point at _local/.
    envDir: localDir,
    plugins: [react()],
    define: {
      // Non-VITE_ keys are never exposed to the client unless defined explicitly.
      'import.meta.env.FAL_API_KEY': JSON.stringify(env.FAL_API_KEY ?? ''),
    },
  }
})
