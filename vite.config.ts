import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/the-bench/',
  test: {
    environment: 'node',
    // Live Gemini API tests (src/lib/llm/__tests__/live/) are excluded from
    // the default hermetic suite regardless of whether a .env key is
    // present locally — they only run via `npm run test:live`
    // (vitest.live.config.ts). See CLAUDE.md's testing section.
    exclude: [...configDefaults.exclude, 'src/lib/llm/__tests__/live/**'],
  },
})
