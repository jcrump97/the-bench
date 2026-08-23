import type {
  CasePayload,
  PleaNarrative,
  PleaDecision,
  Verdict,
  Sentence,
} from '../schemas/gameSchemas';
import type { DemoCaseBundle } from './demoCases';
import { assembleAftermath, selectAftermath } from './demoCases/aftermath';
import { classifyOutcome } from './outcome';
import { severityOfImposedSentence } from './sentenceSeverity';

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
// GameService implements this same interface over the seven-stage Gemini
// pipeline (generateCase) and the post-sentencing Aftermath call
// (generateAftermath); demoCaseSource below is the offline implementation.
// Callers must treat both methods as fallible and asynchronous; outputs still
// pass through the store's Zod boundary before touching game state.
export interface CaseSource {
  generateCase(): Promise<GeneratedCase>;
  generateAftermath(ctx: AftermathContext): Promise<string>;
}

// Demo implementation: resolves instantly from a hand-authored bundle,
// bypassing the LLM entirely, but through the exact seam the BYOK path uses.
// generateAftermath conditions on the player's outcome *and* on how hard the
// sentence landed, the same two things the real Aftermath prompt is told —
// the authored base answers the verdict, the coda answers the term.
export function demoCaseSource(bundle: DemoCaseBundle): CaseSource {
  return {
    generateCase: () =>
      Promise.resolve({ payload: bundle.payload, pleaNarrative: bundle.pleaNarrative }),
    generateAftermath: (ctx) => {
      const base = selectAftermath(bundle, classifyOutcome(ctx.pleaDecision, ctx.verdict));
      const severity = severityOfImposedSentence(
        ctx.caseData,
        ctx.pleaDecision,
        ctx.verdict,
        ctx.imposedSentence,
      );
      // No sentence, no coda: on a full acquittal the base is the whole story.
      return Promise.resolve(assembleAftermath(base, severity && bundle.sentenceCodas[severity.band]));
    },
  };
}
