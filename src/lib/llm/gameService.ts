import { assessProsecution } from '../pleaAssessment';
import { deriveInterrogationProfile } from '../interrogation';
import type { CaseSource, GeneratedCase, AftermathContext } from '../caseSource';
import { getOrSelectModel } from './modelSelection';
import {
  runStatuteSelection,
  runEnvironmentGen,
  runCharacterGen,
  runInterrogationGen,
  runEvidenceGen,
  finalizeCasePayload,
  runPleaNarrative,
  runAftermath,
} from './stages';

// The real CaseSource behind BYOK: orchestrates the five-stage generation
// pipeline (StatuteSelection → EnvironmentGen → CharacterGen →
// InterrogationGen → EvidenceGen → finalizeCasePayload), then the separate
// PleaNarrative and (later) Aftermath calls — each stage's output feeding
// forward as context into the next, per CLAUDE.md's pipeline. Every LLM
// response crosses the same Zod boundary a hand-authored demo case does;
// GameService's job is orchestration and model selection, not validation —
// that lives in stages.ts.
export function createGameService(apiKey: string): CaseSource {
  return {
    async generateCase(): Promise<GeneratedCase> {
      const model = await getOrSelectModel(apiKey);

      const { charges, statuteContexts } = await runStatuteSelection(apiKey, model);
      const environment = await runEnvironmentGen(apiKey, model, charges);
      const defendant = await runCharacterGen(apiKey, model, charges);

      const interrogationProfile = deriveInterrogationProfile(defendant);
      const interrogation = await runInterrogationGen(apiKey, model, defendant, interrogationProfile);

      const { evidence, witnesses } = await runEvidenceGen(
        apiKey,
        model,
        charges,
        environment,
        defendant,
        interrogation,
      );

      const payload = await finalizeCasePayload(apiKey, model, {
        charges,
        statuteContexts,
        environment,
        defendant,
        witnesses,
        evidence,
      });

      const { band } = assessProsecution(payload);
      const pleaNarrative = await runPleaNarrative(apiKey, model, payload, band);

      return { payload, pleaNarrative };
    },

    async generateAftermath(ctx: AftermathContext): Promise<string> {
      const model = await getOrSelectModel(apiKey);
      return runAftermath(apiKey, model, ctx);
    },
  };
}
