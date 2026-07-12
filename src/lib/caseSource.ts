import type {
  CasePayload,
  PleaNarrative,
  PleaDecision,
  Verdict,
  Sentence,
} from '../schemas/gameSchemas';
import type { DemoCaseBundle } from './demoCases';
import { classifyOutcome, selectAftermath } from './demoCases/aftermath';

export interface GeneratedCase {
  payload: CasePayload;
  pleaNarrative: PleaNarrative;
}

// End-of-game context the aftermath is conditioned on. This is the input
// contract for GameService's Aftermath prompt (and the fields ResultGenerator
// will snapshot into FinalResult), so the demo path exercises the same shape.
export interface AftermathContext {
  caseData: CasePayload;
  pleaDecision: PleaDecision | null;
  verdict: Verdict | null;
  imposedSentence: Sentence[];
}

// The seam between the game and whatever produces its narrative content.
//
// [LLM-FILL: CasePayload + PleaNarrative + Aftermath] — GameService implements
// this same interface over the four-stage Gemini pipeline (generateCase) and
// the post-sentencing Aftermath call (generateAftermath). Until then,
// demoCaseSource is the only implementation. Callers must treat both methods
// as fallible and asynchronous; outputs still pass through the store's Zod
// boundary before touching game state.
export interface CaseSource {
  generateCase(): Promise<GeneratedCase>;
  generateAftermath(ctx: AftermathContext): Promise<string>;
}

// Demo implementation: resolves instantly from a hand-authored bundle,
// bypassing the LLM entirely, but through the exact seam the BYOK path will
// use. generateAftermath conditions on the player's outcome the same way the
// real Aftermath prompt will.
export function demoCaseSource(bundle: DemoCaseBundle): CaseSource {
  return {
    generateCase: () =>
      Promise.resolve({ payload: bundle.payload, pleaNarrative: bundle.pleaNarrative }),
    generateAftermath: (ctx) =>
      Promise.resolve(selectAftermath(bundle, classifyOutcome(ctx.pleaDecision, ctx.verdict))),
  };
}
