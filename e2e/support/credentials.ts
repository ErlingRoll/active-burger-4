import { test } from '@playwright/test'
import { loadEnv } from 'vite'

/**
 * Credentials for the authenticated end-to-end flows.
 *
 * These live in `.env.development` (never committed) and are read through Vite's
 * `loadEnv` in development mode, the mode the Playwright web server runs in,
 * so one file configures both the dev server and the Playwright run. They
 * are read in the Node test process only and are never inlined into a client
 * bundle: no `src/` module references them.
 */
const testEnvironment = loadEnv('development', process.cwd(), 'VITE_')

export interface TestCredentials {
  email: string
  password: string
}

/**
 * Skips the current test when credentials are absent, and otherwise returns
 * them narrowed to `string`. `test.skip` aborts the test, so the throw below is
 * unreachable; it exists so the narrowing is proven rather than asserted.
 */
export function requireTestCredentials(purpose: string): TestCredentials {
  const email = testEnvironment.VITE_TEST_USER_EMAIL
  const password = testEnvironment.VITE_TEST_USER_PASSWORD
  test.skip(
    !email || !password,
    `VITE_TEST_USER_EMAIL and VITE_TEST_USER_PASSWORD are required for ${purpose}.`,
  )
  if (email === undefined || password === undefined) {
    throw new Error('Unreachable: test.skip aborts when credentials are missing.')
  }
  return { email, password }
}
