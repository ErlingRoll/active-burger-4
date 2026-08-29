import { execFileSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

const commitVersion = (
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.GITHUB_SHA ??
  execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' })
).trim().slice(0, 7)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(commitVersion),
  },
  server: {
    port: 3000,
  },
  test: {
    // Playwright specs under e2e/ are not Vitest unit tests; keep the two
    // runners from colliding by excluding the e2e/ directory here.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
