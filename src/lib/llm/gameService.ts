import { assessProsecution, derivePleaOfferTerms, assessDefense } from '../pleaAssessment';
import { deriveInterrogationProfile } from '../interrogation';
import type { CaseSource, GeneratedCase, AftermathContext } from '../caseSource';
import type { Charge } from '../../schemas/gameSchemas';
import { getOrSelectModel } from './modelSelection';
import {
  GameServiceError,
  runStatuteSelection,
  runEnvironmentGen,
  runCharacterGen,
  runInterrogationGen,
  runEvidenceGen,
  runVerdictVoice,
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
      const interrogation = await runInterrogationGen(apiKey, model, defendant, environment, interrogationProfile);

      const { evidence, witnesses } = await runEvidenceGen(
        apiKey,
        model,
        charges,
        environment,
        defendant,
        interrogation,
      );

      const chargeVoices = await runVerdictVoice(apiKey, model, charges, defendant);
      const chargesWithVoice: Charge[] = charges.map((charge) => {
        const voice = chargeVoices.find((c) => c.id === charge.id);
        // runVerdictVoice's schema now requires an entry for every requested
        // charge id, so a miss here is unreachable in practice — kept as a
        // typed, stage-prefixed guard rather than a bare Error so that if it
        // ever does fire, the Mistrial screen names the stage like every other
        // pipeline failure instead of reporting a generic `generateCase`.
        if (!voice) throw new GameServiceError(`[VerdictVoice] no voiced verdict layer returned for charge ${charge.id}`);
        return { ...charge, ...voice };
      });

      const payload = await finalizeCasePayload(apiKey, model, {
        charges: chargesWithVoice,
        statuteContexts,
        environment,
        defendant,
        witnesses,
        evidence,
      });

      const { band } = assessProsecution(payload);
      const offerTerms = band === 'WEAK' ? null : derivePleaOfferTerms(payload, band);
      const defensePosture = offerTerms === null ? 'REJECT' : assessDefense(payload, offerTerms.proposedSentence).posture;
      const pleaNarrative = await runPleaNarrative(apiKey, model, payload, band, offerTerms, defensePosture);

      return { payload, pleaNarrative };
    },

    async generateAftermath(ctx: AftermathContext): Promise<string> {
      const model = await getOrSelectModel(apiKey);
      return runAftermath(apiKey, model, ctx);
    },
  };
}
