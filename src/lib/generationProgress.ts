// What a case generation is doing, step by step — the vocabulary GameService
// reports in and the generating screen renders from.
//
// Display only, by construction: nothing here crosses a trust boundary or
// feeds a derivation. Every generated payload still reaches the game through
// the store's Zod setters; this module just lets the player watch it being
// built. It lives in lib/ rather than lib/llm/ so the UI can import it without
// pulling the pipeline into the main bundle.

// A step is either a Gemini call or a deterministic derivation the pipeline
// runs between calls. Showing both is the point: the computed steps are where
// the game's structure comes from, and the model never writes them.
export type GenerationStepKind = 'MODEL' | 'COMPUTED';

export type GenerationStepId =
  | 'MODEL_SELECTION'
  | 'STATUTES'
  | 'SCENE'
  | 'DEFENDANT'
  | 'INTERROGATION_PROFILE'
  | 'INTERROGATION'
  | 'EVIDENCE'
  | 'VERDICT_VOICE'
  | 'FINALIZE'
  | 'PLEA_STRUCTURE'
  | 'PLEA_NARRATIVE';

export interface GenerationStep {
  id: GenerationStepId;
  kind: GenerationStepKind;
  label: string;
  // One line on what the step produces, in a player's words.
  detail: string;
}

// In the order the pipeline starts them. Steps that run concurrently in
// gameService.ts (scene ∥ defendant; verdict voice ∥ interview → evidence)
// simply show as running at the same time.
export const GENERATION_STEPS: readonly GenerationStep[] = [
  { id: 'MODEL_SELECTION', kind: 'MODEL', label: 'Model selection', detail: 'Ask Gemini which models this key can use, and pick the cheapest capable one' },
  { id: 'STATUTES', kind: 'MODEL', label: 'Statute selection', detail: 'The charges, their elements, and each statutory sentencing range' },
  { id: 'SCENE', kind: 'MODEL', label: 'Scene', detail: 'Where it happened, and the facts every later stage must agree with' },
  { id: 'DEFENDANT', kind: 'MODEL', label: 'Defendant', detail: 'A life: family, work, history, temperament' },
  { id: 'INTERROGATION_PROFILE', kind: 'COMPUTED', label: 'Interview outcome', detail: "What the interview room produced, derived from the defendant's temperament and record" },
  { id: 'INTERROGATION', kind: 'MODEL', label: 'Interview recording', detail: 'The tape, written to dramatize exactly that outcome' },
  { id: 'EVIDENCE', kind: 'MODEL', label: 'Evidence & witnesses', detail: 'Exhibits, counsel’s arguments over them, and testimony' },
  { id: 'VERDICT_VOICE', kind: 'MODEL', label: 'Verdict voice', detail: 'What the court may say at each verdict, and how the room reacts' },
  { id: 'FINALIZE', kind: 'MODEL', label: 'Case file assembly', detail: 'Statement of facts and closings; cross-stage ids reconciled in code' },
  { id: 'PLEA_STRUCTURE', kind: 'COMPUTED', label: 'Plea structure', detail: 'Case strength, the offer, and whether the defense takes it' },
  { id: 'PLEA_NARRATIVE', kind: 'MODEL', label: 'Plea positions', detail: 'Counsel argue the terms the engine just computed' },
];

export type GenerationProgressEvent =
  | { stepId: GenerationStepId; status: 'STARTED'; at: number }
  | { stepId: GenerationStepId; status: 'DONE'; at: number }
  // A step the case does not need — the interview recording, when the
  // defendant invoked counsel and no tape exists.
  | { stepId: GenerationStepId; status: 'SKIPPED'; at: number };

export interface StepProgress {
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'SKIPPED';
  startedAt: number | null;
  finishedAt: number | null;
}

export type GenerationProgress = Record<GenerationStepId, StepProgress>;

export function initialGenerationProgress(): GenerationProgress {
  const pending: StepProgress = { status: 'PENDING', startedAt: null, finishedAt: null };
  return Object.fromEntries(GENERATION_STEPS.map((step) => [step.id, pending])) as GenerationProgress;
}

// Pure reducer. Events are applied as they arrive; a late or repeated event
// can only move a step forward, never back to running once it finished.
export function applyGenerationProgress(
  progress: GenerationProgress,
  event: GenerationProgressEvent,
): GenerationProgress {
  const current = progress[event.stepId];
  if (current.status === 'DONE' || current.status === 'SKIPPED') return progress;

  const next: StepProgress =
    event.status === 'STARTED'
      ? { status: 'RUNNING', startedAt: event.at, finishedAt: null }
      : { status: event.status, startedAt: current.startedAt ?? event.at, finishedAt: event.at };
  return { ...progress, [event.stepId]: next };
}

export interface GenerateCaseOptions {
  // Called as each step starts and finishes. Display only — never awaited,
  // and a throwing listener must not be able to fail the generation.
  onProgress?: (event: GenerationProgressEvent) => void;
  // Checked between steps. An in-flight call is left to finish (each attempt
  // is bounded by the transport's timeout) and its result is discarded.
  signal?: AbortSignal;
}

// Thrown when the player cancels a generation. Distinct from every failure
// type so the caller can return to the docket instead of declaring a
// mistrial — nothing went wrong.
export class GenerationCancelledError extends Error {
  constructor() {
    super('Case generation was cancelled');
    this.name = 'GenerationCancelledError';
  }
}
