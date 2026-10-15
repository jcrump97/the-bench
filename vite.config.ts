import { defineConfig, configDefaults } from 'vitest/config'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The player pastes a Gemini API key into this page, so the deployed build
// carries a Content-Security-Policy: scripts, styles and chunks from this
// origin only, and network requests to this origin and the Gemini API only.
// It does not make the key safe from an injected script (one could still read
// it from memory, or navigate away with it in the URL), but such a script can
// no longer be loaded from elsewhere or fetch() the key to another server.
//
// Build only: the dev server injects inline scripts for hot reload, which
// this policy would block. GitHub Pages cannot set response headers, so it
// travels as a <meta> tag — which is also why frame-ancestors is absent
// (browsers ignore it in a meta tag and log an error saying so).
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://generativelanguage.googleapis.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

function contentSecurityPolicy(): Plugin {
  return {
    name: 'the-bench:content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
        injectTo: 'head-prepend',
      },
    ],
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), contentSecurityPolicy()],
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
