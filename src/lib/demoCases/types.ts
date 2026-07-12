import {
  CasePayloadSchema,
  PleaNarrativeSchema,
  type CasePayload,
  type PleaNarrative,
} from '../../schemas/gameSchemas';

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
  aftermathNarrative: string;
}

interface RawDemoCase {
  title: string;
  teaser: string;
  payload: unknown;
  pleaNarrative: unknown;
  aftermathNarrative: string;
}

// FinalResultSchema.aftermathNarrative bound — authored text must fit the
// persisted snapshot it will eventually be written into.
const AFTERMATH_MAX_LENGTH = 4000;

// Demo cases feed the ValidationLayer exactly like LLM output will: parsed
// at the boundary, throwing loudly at module load if an authored case drifts
// out of schema.
export function defineDemoCase(raw: RawDemoCase): DemoCaseBundle {
  const payload = CasePayloadSchema.parse(raw.payload);
  const pleaNarrative = PleaNarrativeSchema.parse(raw.pleaNarrative);
  if (raw.aftermathNarrative.length === 0 || raw.aftermathNarrative.length > AFTERMATH_MAX_LENGTH) {
    throw new Error(`Demo case ${payload.caseId}: aftermathNarrative must be 1-${AFTERMATH_MAX_LENGTH} chars`);
  }
  return {
    id: payload.caseId,
    title: raw.title,
    teaser: raw.teaser,
    payload,
    pleaNarrative,
    aftermathNarrative: raw.aftermathNarrative,
  };
}
