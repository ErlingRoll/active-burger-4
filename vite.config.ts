import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { configDefaults, defineConfig } from 'vitest/config'

/*
 * The build stamp shown in the header: which environment this build serves,
 * the release from package.json, the commit it was built from, and when.
 *
 * The commit comes from the host when it provides one (Netlify sets
 * COMMIT_REF, GitHub Actions GITHUB_SHA, Vercel VERCEL_GIT_COMMIT_SHA) and
 * from git locally. It is also what a run snapshot records as its game
 * version, so its meaning must not change: a saved run compares it.
 */
const commitVersion = (
  process.env.COMMIT_REF ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.GITHUB_SHA ??
  execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' })
).trim().slice(0, 7)

const releaseVersion: string = (
  JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
).version

/**
 * "production" or "dev". An explicit VITE_APP_ENVIRONMENT in the env file or
 * the host wins. Otherwise Netlify's CONTEXT decides for a hosted build (only
 * the production context is production; branch deploys and previews are dev),
 * and a local build follows its Vite mode, which is the env file it read.
 */
function resolveEnvironment(mode: string): 'production' | 'dev' {
  const explicit = process.env.VITE_APP_ENVIRONMENT ?? loadEnv(mode, process.cwd(), 'VITE_').VITE_APP_ENVIRONMENT
  if (explicit === 'production' || explicit === 'dev') {
    return explicit
  }
  if (process.env.CONTEXT) {
    return process.env.CONTEXT === 'production' ? 'production' : 'dev'
  }
  return mode === 'production' ? 'production' : 'dev'
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(commitVersion),
    'import.meta.env.VITE_APP_RELEASE': JSON.stringify(releaseVersion),
    'import.meta.env.VITE_APP_BUILT_AT': JSON.stringify(new Date().toISOString()),
    'import.meta.env.VITE_APP_ENVIRONMENT': JSON.stringify(resolveEnvironment(mode)),
  },
  server: {
    port: 3000,
  },
  test: {
    // Playwright specs under e2e/ are not Vitest unit tests; keep the two
    // runners from colliding by excluding the e2e/ directory here.
    exclude: [...configDefaults.exclude, 'e2e/**'],
    setupFiles: ['./src/testing/setup.ts'],
    // The simulation suite is environment-free and must stay that way, so jsdom
    // is opted into per file with `// @vitest-environment jsdom` rather than
    // made the default. Component specs use `renderComponent` from
    // `src/testing/render.tsx`, which sets that pragma's expectations up.
    environment: 'node',
  },
}))
