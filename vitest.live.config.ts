import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Separate from vite.config.ts's test block on purpose: these tests hit the
// real Gemini API (see src/lib/llm/__tests__/live/), so they need a longer
// timeout and must never be picked up by the default `npm test` run. Run
// with `npm run test:live` — skips cleanly if no key is available
// (src/lib/llm/__tests__/live/liveEnv.ts).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/the-bench/',
  test: {
    environment: 'node',
    include: ['src/lib/llm/__tests__/live/**/*.live.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 240_000,
  },
})
