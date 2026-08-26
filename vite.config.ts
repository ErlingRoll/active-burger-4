import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Playwright specs under e2e/ are not Vitest unit tests; keep the two
    // runners from colliding by excluding the e2e/ directory here.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
