// Diagnostic seam for the generation pipeline — observability only, never
// game behavior.
//
// The pipeline chains seven independent stages, and a mistrial only ever
// surfaces the *last* stage's error message. That says nothing about which
// constraint actually failed, how often, or on which attempt — the questions
// you need answered to fix a systemic failure rate rather than one anecdote.
// `generateValidated` reports every failed attempt here; when nothing is
// observing, the call is a no-op.
//
// Deliberately module-scoped rather than threaded through all eight stage
// signatures: this is a cross-cutting concern with no effect on the pipeline's
// contract, and the app never sets an observer. Only the live diagnostic
// (src/lib/llm/__tests__/live/pipelineDiagnostic.live.test.ts) does.

export type GenerationFailureKind =
  // The Gemini call itself threw — network error, or a 429/5xx that already
  // exhausted fetchWithRetry's own attempts.
  | 'CALL_FAILED'
  // A response came back but wasn't parseable JSON (often a truncated
  // response rather than genuinely malformed output).
  | 'BAD_JSON'
  // Parsed fine, but the Zod gate rejected it. `issues` carries one
  // "path: message" entry per Zod issue — the interesting case.
  | 'SCHEMA';

export interface GenerationAttemptFailure {
  stage: string;
  /** 0-based: attempt 0 is the first try, not a retry. */
  attempt: number;
  kind: GenerationFailureKind;
  issues: string[];
}

type GenerationObserver = (failure: GenerationAttemptFailure) => void;

let observer: GenerationObserver | null = null;

export function setGenerationObserver(next: GenerationObserver | null): void {
  observer = next;
}

export function reportAttemptFailure(failure: GenerationAttemptFailure): void {
  observer?.(failure);
}
