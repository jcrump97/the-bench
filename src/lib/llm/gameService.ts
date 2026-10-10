import { assessProsecution, derivePleaOfferTerms, assessDefense } from '../pleaAssessment';
import { deriveInterrogationProfile } from '../interrogation';
import type { CaseSource, GeneratedCase, AftermathContext } from '../caseSource';
import {
  GenerationCancelledError,
  type GenerateCaseOptions,
  type GenerationStepId,
} from '../generationProgress';
import type { Charge, Interrogation } from '../../schemas/gameSchemas';
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

// Wraps each pipeline step with the two observational concerns, so the
// orchestration below reads as the pipeline and nothing else: a cancel check
// before the step starts, and STARTED/DONE progress events around it. A
// listener that throws is contained here — watching a generation must never
// be able to fail one.
function createStepRunner({ onProgress, signal }: GenerateCaseOptions) {
  const emit = (stepId: GenerationStepId, status: 'STARTED' | 'DONE' | 'SKIPPED') => {
    try {
      onProgress?.({ stepId, status, at: Date.now() });
    } catch {
      // Display only; ignore.
    }
  };

  return {
    async step<T>(stepId: GenerationStepId, run: () => T | Promise<T>): Promise<T> {
      if (signal?.aborted) throw new GenerationCancelledError();
      emit(stepId, 'STARTED');
      const result = await run();
      emit(stepId, 'DONE');
      return result;
    },
    skip(stepId: GenerationStepId): void {
      emit(stepId, 'SKIPPED');
    },
  };
}

// The real CaseSource behind BYOK: orchestrates the seven-stage generation
// pipeline (StatuteSelection → EnvironmentGen → CharacterGen →
// InterrogationGen → EvidenceGen → VerdictVoice → PleaNarrative, with
// finalizeCasePayload's assembly and repair between the last two), then the
// separate Aftermath call once the case closes — each stage's output feeding
// forward as context into the next, per CLAUDE.md's pipeline. Every LLM
// response crosses the same Zod boundary a hand-authored demo case does;
// GameService's job is orchestration and model selection, not validation —
// that lives in stages.ts.
export function createGameService(apiKey: string): CaseSource {
  return {
    async generateCase(options: GenerateCaseOptions = {}): Promise<GeneratedCase> {
      const { step, skip } = createStepRunner(options);

      const model = await step('MODEL_SELECTION', () => getOrSelectModel(apiKey));

      const { charges, statuteContexts } = await step('STATUTES', () => runStatuteSelection(apiKey, model));
      // Two pairs of stages share no inputs with each other, so each pair runs
      // concurrently: the scene and the defendant both need only the charges,
      // and the verdict voice needs only the charges and the defendant — not
      // the interview or the evidence. Seven sequential round trips become
      // five on the critical path. Every stage still validates independently;
      // if one fails, the run fails, and its sibling's result is discarded.
      const [environment, defendant] = await Promise.all([
        step('SCENE', () => runEnvironmentGen(apiKey, model, charges)),
        step('DEFENDANT', () => runCharacterGen(apiKey, model, charges)),
      ]);

      const writeEvidence = async () => {
        const interrogationProfile = await step('INTERROGATION_PROFILE', () => deriveInterrogationProfile(defendant));
        // No tape exists when the defendant invoked counsel, so there is
        // nothing to write: the step is reported as skipped rather than run.
        let interrogation: Interrogation | null = null;
        if (interrogationProfile.outcome === 'INVOKED_COUNSEL') {
          skip('INTERROGATION');
        } else {
          interrogation = await step('INTERROGATION', () =>
            runInterrogationGen(apiKey, model, defendant, environment, interrogationProfile),
          );
        }
        return step('EVIDENCE', () => runEvidenceGen(apiKey, model, charges, environment, defendant, interrogation));
      };

      const [{ evidence, witnesses }, chargeVoices] = await Promise.all([
        writeEvidence(),
        step('VERDICT_VOICE', () => runVerdictVoice(apiKey, model, charges, defendant)),
      ]);

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

      const payload = await step('FINALIZE', () =>
        finalizeCasePayload(apiKey, model, {
          charges: chargesWithVoice,
          statuteContexts,
          environment,
          defendant,
          witnesses,
          evidence,
        }),
      );

      const { band, offerTerms, defensePosture } = await step('PLEA_STRUCTURE', () => {
        const { band } = assessProsecution(payload);
        const offerTerms = band === 'WEAK' ? null : derivePleaOfferTerms(payload, band);
        const defensePosture =
          offerTerms === null ? 'REJECT' : assessDefense(payload, offerTerms.proposedSentence).posture;
        return { band, offerTerms, defensePosture } as const;
      });
      const pleaNarrative = await step('PLEA_NARRATIVE', () =>
        runPleaNarrative(apiKey, model, payload, band, offerTerms, defensePosture),
      );

      return { payload, pleaNarrative };
    },

    async generateAftermath(ctx: AftermathContext): Promise<string> {
      const model = await getOrSelectModel(apiKey);
      return runAftermath(apiKey, model, ctx);
    },
  };
}
