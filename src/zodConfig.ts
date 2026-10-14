import { z } from 'zod';

// Imported first in main.tsx, before any module that builds a schema: Zod
// reads this flag when each schema is constructed, not when it parses.
//
// Without it, Zod probes `new Function('')` to decide whether it may compile
// fast-path parsers. The production build ships a Content-Security-Policy
// with no 'unsafe-eval' (vite.config.ts), and a strict CSP reports even a
// caught probe as a violation on every page load. Jitless parsing gives the
// same results; it only skips the compiled fast path, which nothing here
// needs at these payload sizes.
z.config({ jitless: true });
