import type { CasePayload, DialogueScript, DialogueBeat, PleaPosture } from '../schemas/gameSchemas';

// Cross-payload checks the schema itself can't see (DialogueScriptSchema only
// validates intra-script structure — beat-id uniqueness, choice coverage —
// never against a CasePayload). Called both at demo module load
// (defineDemoCase) and by the store's setActiveDialogueScript, which requires
// activeCase to already be hydrated. Returns human-readable issue strings;
// an empty array means the script is valid against this case + posture.
export function validateDialogueScriptAgainstCase(
  script: DialogueScript,
  payload: CasePayload,
  posture: PleaPosture,
): string[] {
  const issues: string[] = [];

  // 1. motion evidenceIds must be set-equal to payload.evidence ids.
  const scriptEvidenceIds = new Set(script.motions.map((m) => m.evidenceId));
  const payloadEvidenceIds = new Set(payload.evidence.map((e) => e.id));
  for (const id of payloadEvidenceIds) {
    if (!scriptEvidenceIds.has(id)) {
      issues.push(`Evidence ${id} has no motion dialogue in the script`);
    }
  }
  for (const id of scriptEvidenceIds) {
    if (!payloadEvidenceIds.has(id)) {
      issues.push(`Motion dialogue references unknown evidenceId ${id}`);
    }
  }

  // 2. verdict chargeIds must be set-equal to payload.charges ids.
  const scriptChargeIds = new Set(script.verdicts.map((v) => v.chargeId));
  const payloadChargeIds = new Set(payload.charges.map((c) => c.id));
  for (const id of payloadChargeIds) {
    if (!scriptChargeIds.has(id)) {
      issues.push(`Charge ${id} has no verdict dialogue in the script`);
    }
  }
  for (const id of scriptChargeIds) {
    if (!payloadChargeIds.has(id)) {
      issues.push(`Verdict dialogue references unknown chargeId ${id}`);
    }
  }

  // 3. every WITNESS TranscriptLine's characterId must resolve to a witness.
  const witnessIds = new Set(payload.witnesses.map((w) => w.id));
  for (const beat of allBeats(script)) {
    for (const line of beat.lines) {
      if (line.speaker === 'WITNESS' && line.characterId !== null && !witnessIds.has(line.characterId)) {
        issues.push(`WITNESS line in beat ${beat.id} references unknown characterId ${line.characterId}`);
      }
    }
  }

  // 4. script.plea !== null iff posture.status === 'PENDING_JUDICIAL_REVIEW'.
  const pleaRequired = posture.status === 'PENDING_JUDICIAL_REVIEW';
  if (pleaRequired && script.plea === null) {
    issues.push('Posture is PENDING_JUDICIAL_REVIEW but the script has no plea dialogue');
  }
  if (!pleaRequired && script.plea !== null) {
    issues.push(`Posture is ${posture.status} but the script has a plea dialogue`);
  }

  return issues;
}

// Walks every beat location in the script: openingBeat, plea's promptBeat +
// both reaction beats (when plea !== null), every motion's promptBeat + both
// reaction beats, every verdict's promptBeat + both reaction beats.
function allBeats(script: DialogueScript): DialogueBeat[] {
  const beats: DialogueBeat[] = [script.openingBeat];

  if (script.plea !== null) {
    beats.push(script.plea.promptBeat, script.plea.reactionBeats.ACCEPT, script.plea.reactionBeats.REJECT);
  }

  for (const motion of script.motions) {
    beats.push(motion.promptBeat, motion.reactionBeats.ADMITTED, motion.reactionBeats.EXCLUDED);
  }

  for (const verdict of script.verdicts) {
    beats.push(verdict.promptBeat, verdict.reactionBeats.GUILTY, verdict.reactionBeats.NOT_GUILTY);
  }

  return beats;
}
