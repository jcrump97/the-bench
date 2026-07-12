import type { DemoCaseBundle } from './types';
import { webbCase } from './webb';
import { booneCase } from './boone';
import { reyesCase } from './reyes';
import { vaughnCase } from './vaughn';

export type { DemoCaseBundle } from './types';

// The demo docket: every hardcoded case available for offline/keyless play
// (isDemo === true in useSecurityStore). Bundles bypass GameService and the
// LLM pipeline entirely and feed directly into the ValidationLayer.
// Typed as a non-empty tuple so "no demo cases" is inexpressible.
export const DEMO_CASES: readonly [DemoCaseBundle, ...DemoCaseBundle[]] = [
  webbCase,   // MODERATE → offer pending judicial review (player chooses the branch)
  booneCase,  // WEAK → no offer (trial-only)
  reyesCase,  // STRONG → offer rejected by the defense (trial-only, terms shown)
  vaughnCase, // MODERATE, multi-charge → offer pending; per-charge verdicts, SPLIT reachable
];

{
  const ids = new Set<string>();
  for (const bundle of DEMO_CASES) {
    if (ids.has(bundle.id)) {
      throw new Error(`Duplicate demo case id: ${bundle.id}`);
    }
    ids.add(bundle.id);
  }
}

// Render-safe lookup: returns undefined off the demo path (e.g. a future
// LLM-generated case) instead of throwing mid-render.
export function findDemoCaseById(caseId: string): DemoCaseBundle | undefined {
  return DEMO_CASES.find((bundle) => bundle.id === caseId);
}
