import {
  CasePayloadSchema,
  PleaNarrativeSchema,
  type CasePayload,
  type PleaNarrative,
} from '../../schemas/gameSchemas';
import { computePleaPostureForCase } from '../pleaAssessment';

// How the player's run of a case can end. The real Aftermath LLM call will be
// conditioned on this same end-of-game state; demo bundles author one
// narrative per reachable outcome instead.
export type AftermathOutcome = 'PLEA_ACCEPTED' | 'CONVICTED' | 'ACQUITTED' | 'SPLIT';

// PLEA_ACCEPTED is optional at the type level because reachability depends on
// the case's *computed* plea posture (only PENDING_JUDICIAL_REVIEW puts an
// offer before the judge) — defineDemoCase enforces the exact match at module
// load. SPLIT is structural: a single-charge verdict cannot split, so the
// single-charge shape forbids it and the multi-charge shape requires it.
type AftermathVariantsBase = {
  PLEA_ACCEPTED?: string;
  CONVICTED: string;
  ACQUITTED: string;
};
export type SingleChargeAftermath = AftermathVariantsBase & { SPLIT?: never };
export type MultiChargeAftermath = AftermathVariantsBase & { SPLIT: string };
export type AftermathVariants = SingleChargeAftermath | MultiChargeAftermath;

// A complete offline case: everything the LLM pipeline will eventually
// generate for one docket entry, hand-authored and validated at module load.
//
// [LLM-FILL] convention: every point in a demo bundle (or the runtime flow)
// that the future GameService pipeline will fill is tagged with a grep-able
// `[LLM-FILL: <stage>]` comment, where <stage> is one of the pipeline calls:
// StatuteSelection, EnvironmentGen, CharacterGen, EvidenceGen, CasePayload
// (final assembly), PleaNarrative, or Aftermath.
export interface DemoCaseBundle {
  // Mirrors payload.caseId (enforced by defineDemoCase) so registry lookups
  // and store state key off the same identifier.
  id: string;
  // Docket-picker presentation only — never crosses a trust boundary.
  title: string;
  teaser: string;
  payload: CasePayload;
  pleaNarrative: PleaNarrative;
  aftermath: AftermathVariants;
}

interface RawDemoCase {
  title: string;
  teaser: string;
  payload: unknown;
  pleaNarrative: unknown;
  aftermath: AftermathVariants;
}

// FinalResultSchema.aftermathNarrative bound — authored text must fit the
// persisted snapshot it will eventually be written into.
const AFTERMATH_MAX_LENGTH = 4000;

// Demo cases feed the ValidationLayer exactly like LLM output will: parsed
// at the boundary, throwing loudly at module load if an authored case drifts
// out of schema or its aftermath variants stop matching the outcomes the
// deterministic engine actually makes reachable.
export function defineDemoCase(raw: RawDemoCase): DemoCaseBundle {
  const payload = CasePayloadSchema.parse(raw.payload);
  const pleaNarrative = PleaNarrativeSchema.parse(raw.pleaNarrative);

  for (const [outcome, text] of Object.entries(raw.aftermath)) {
    if (typeof text !== 'string' || text.length === 0 || text.length > AFTERMATH_MAX_LENGTH) {
      throw new Error(`Demo case ${payload.caseId}: aftermath ${outcome} must be 1-${AFTERMATH_MAX_LENGTH} chars`);
    }
  }

  // Reachability invariants the type system cannot see (the posture is
  // derived from the payload's numbers, not declared):
  const { posture } = computePleaPostureForCase(payload, pleaNarrative);
  if (posture.status === 'NO_OFFER' && pleaNarrative.defenseRationale !== undefined) {
    throw new Error(`Demo case ${payload.caseId}: a NO_OFFER (WEAK) case must not carry a defenseRationale`);
  }
  const pleaReachable = posture.status === 'PENDING_JUDICIAL_REVIEW';
  if (pleaReachable !== (raw.aftermath.PLEA_ACCEPTED !== undefined)) {
    throw new Error(
      `Demo case ${payload.caseId}: aftermath.PLEA_ACCEPTED must be authored exactly when the computed posture is PENDING_JUDICIAL_REVIEW (got ${posture.status})`
    );
  }
  const splitReachable = payload.charges.length > 1;
  if (splitReachable !== (raw.aftermath.SPLIT !== undefined)) {
    throw new Error(
      `Demo case ${payload.caseId}: aftermath.SPLIT must be authored exactly when the case has multiple charges (got ${payload.charges.length})`
    );
  }

  return {
    id: payload.caseId,
    title: raw.title,
    teaser: raw.teaser,
    payload,
    pleaNarrative,
    aftermath: raw.aftermath,
  };
}
