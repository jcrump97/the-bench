import { describe, it, expect } from 'vitest';
import {
  CasePayloadSchema,
  ChargeSchema,
  EvidenceSchema,
  WitnessSchema,
  PleaNarrativeSchema,
  ReactionLineSchema,
  AftermathNarrativeSchema,
} from '../gameSchemas';
import { rawValidCase, rawInterrogationEvidence } from '../../lib/__tests__/fixtures';

describe('ChargeSchema per-charge sentencing range', () => {
  const rawCharge = rawValidCase.charges[0];

  it('accepts a charge whose minimum is within its maximum', () => {
    const result = ChargeSchema.safeParse({
      ...rawCharge,
      mandatoryMinimums: [{ type: 'PRISON', unit: 'YEARS', amount: 2 }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a charge missing maximumPenalties entirely', () => {
    const withoutMax: Record<string, unknown> = { ...rawCharge };
    delete withoutMax.maximumPenalties;
    expect(ChargeSchema.safeParse(withoutMax).success).toBe(false);
  });

  it('rejects a mandatoryMinimums entry with no matching-type maximumPenalties entry', () => {
    const result = ChargeSchema.safeParse({
      ...rawCharge,
      mandatoryMinimums: [{ type: 'FINE', unit: 'DOLLARS', amount: 500 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a mandatoryMinimums entry that exceeds its matching maximumPenalties entry', () => {
    const result = ChargeSchema.safeParse({
      ...rawCharge,
      mandatoryMinimums: [{ type: 'PRISON', unit: 'YEARS', amount: 11 }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts a mandatoryMinimums entry equal to its matching maximumPenalties entry', () => {
    const result = ChargeSchema.safeParse({
      ...rawCharge,
      mandatoryMinimums: [{ type: 'PRISON', unit: 'YEARS', amount: 10 }],
    });
    expect(result.success).toBe(true);
  });
});

describe('EvidenceSchema courtroom argument fields', () => {
  const lowRisk = rawValidCase.evidence[0];   // LOW, defenseObjection null
  const highRisk = rawValidCase.evidence[2];  // HIGH, defenseObjection present

  it('accepts a LOW-risk exhibit with a waived (null) defenseObjection', () => {
    expect(EvidenceSchema.safeParse(lowRisk).success).toBe(true);
  });

  it('accepts a LOW-risk exhibit that still carries an objection', () => {
    const result = EvidenceSchema.safeParse({
      ...lowRisk,
      defenseObjection: 'Objection — chain of custody.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a MEDIUM- or HIGH-risk exhibit whose defenseObjection is null', () => {
    for (const risk of ['MEDIUM', 'HIGH'] as const) {
      const result = EvidenceSchema.safeParse({
        ...lowRisk,
        objectionRisk: risk,
        defenseObjection: null,
      });
      expect(result.success).toBe(false);
    }
  });

  it('rejects an exhibit missing prosecutionArgument entirely', () => {
    const withoutArgument: Record<string, unknown> = { ...highRisk };
    delete withoutArgument.prosecutionArgument;
    expect(EvidenceSchema.safeParse(withoutArgument).success).toBe(false);
  });

  it('rejects an exhibit missing disclosureSummary entirely', () => {
    const withoutDisclosure: Record<string, unknown> = { ...highRisk };
    delete withoutDisclosure.disclosureSummary;
    expect(EvidenceSchema.safeParse(withoutDisclosure).success).toBe(false);
  });
});

describe('EvidenceSchema interrogation exhibits', () => {
  it('accepts a well-formed INTERROGATION exhibit', () => {
    expect(EvidenceSchema.safeParse(rawInterrogationEvidence).success).toBe(true);
  });

  it('rejects an INTERROGATION exhibit missing its interrogation block', () => {
    const withoutBlock: Record<string, unknown> = { ...rawInterrogationEvidence };
    delete withoutBlock.interrogation;
    expect(EvidenceSchema.safeParse(withoutBlock).success).toBe(false);
  });

  it('rejects an interrogation block on any other evidence type', () => {
    const result = EvidenceSchema.safeParse({
      ...rawInterrogationEvidence,
      type: 'DIGITAL',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an INTERROGATION exhibit with a waived (null) defenseObjection', () => {
    // Even at LOW risk — the tape is always challenged.
    const result = EvidenceSchema.safeParse({
      ...rawInterrogationEvidence,
      objectionRisk: 'LOW',
      defenseObjection: null,
    });
    expect(result.success).toBe(false);
  });

  it('bounds the transcript at 4–24 lines with closed speakers', () => {
    const line = rawInterrogationEvidence.interrogation.lines[0];
    const withLines = (lines: unknown[]) =>
      EvidenceSchema.safeParse({
        ...rawInterrogationEvidence,
        interrogation: { ...rawInterrogationEvidence.interrogation, lines },
      }).success;
    expect(withLines([line, line, line])).toBe(false);
    expect(withLines(Array.from({ length: 24 }, () => line))).toBe(true);
    expect(withLines(Array.from({ length: 25 }, () => line))).toBe(false);
    expect(withLines([line, line, line, { speaker: 'COURT', text: 'Order.' }])).toBe(false);
  });

  it('rejects an interrogation outcome outside the echo vocabulary (INVOKED_COUNSEL has no tape)', () => {
    const result = EvidenceSchema.safeParse({
      ...rawInterrogationEvidence,
      interrogation: { ...rawInterrogationEvidence.interrogation, outcome: 'INVOKED_COUNSEL' },
    });
    expect(result.success).toBe(false);
  });
});

// The Bench is always a bench trial: the judge alone rules and decides every
// verdict, so no party's voiced dialogue may reference a jury. A live Gemini
// run once produced "the jury is entitled to hear it" in a prosecutionArgument
// field — a schema-shape check couldn't have caught that, only a content
// check on the string itself.
describe('noJury bench-trial guard', () => {
  it('rejects a courtroom argument field that references a jury', () => {
    const result = EvidenceSchema.safeParse({
      ...rawValidCase.evidence[2],
      prosecutionArgument: 'The People offer this exhibit, and the jury is entitled to hear it.',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a defenseObjection that references jurors', () => {
    const result = EvidenceSchema.safeParse({
      ...rawValidCase.evidence[2],
      defenseObjection: 'Objection — the jurors should never hear this.',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a reaction line that references a jury', () => {
    const result = ReactionLineSchema.safeParse({
      speaker: 'PROSECUTION',
      text: 'The jury can decide what to make of it.',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an aftermath narrative that references jurors', () => {
    const result = AftermathNarrativeSchema.safeParse(
      'The jurors deliberated for three hours before returning a verdict.',
    );
    expect(result.success).toBe(false);
  });

  it('is case-insensitive and catches "juror" and "jurys" typo-adjacent forms too', () => {
    expect(ReactionLineSchema.safeParse({ speaker: 'DEFENSE', text: 'JURY.' }).success).toBe(false);
    expect(ReactionLineSchema.safeParse({ speaker: 'DEFENSE', text: 'One juror agreed.' }).success).toBe(false);
  });

  it('does not false-positive on unrelated words containing the substring "jur"', () => {
    const result = ReactionLineSchema.safeParse({
      speaker: 'CLERK',
      text: 'The court finds this an injury sufficient to satisfy the element.',
    });
    expect(result.success).toBe(true);
  });

  it('accepts ordinary bench-trial dialogue with no jury reference', () => {
    const result = ReactionLineSchema.safeParse({
      speaker: 'PROSECUTION',
      text: 'The court can weigh it however it needs to.',
    });
    expect(result.success).toBe(true);
  });
});

describe('WitnessSchema testimony fields', () => {
  const witness = rawValidCase.witnesses[0];

  it('accepts a witness with direct and cross testimony', () => {
    expect(WitnessSchema.safeParse(witness).success).toBe(true);
  });

  it('accepts a declined cross (null)', () => {
    expect(WitnessSchema.safeParse({ ...witness, crossExamination: null }).success).toBe(true);
  });

  it('rejects a witness missing directExamination', () => {
    const withoutDirect: Record<string, unknown> = { ...witness };
    delete withoutDirect.directExamination;
    expect(WitnessSchema.safeParse(withoutDirect).success).toBe(false);
  });
});

describe('Reaction beats (choice-keyed courtroom reactions)', () => {
  const rawCharge = rawValidCase.charges[0];
  const rawEvidence = rawValidCase.evidence[0];
  const line = { speaker: 'DEFENSE', text: 'The defense notes its exception.' };

  it('rejects a charge missing verdictReactions entirely', () => {
    const without: Record<string, unknown> = { ...rawCharge };
    delete without.verdictReactions;
    expect(ChargeSchema.safeParse(without).success).toBe(false);
  });

  it('rejects an exhibit missing rulingReactions entirely', () => {
    const without: Record<string, unknown> = { ...rawEvidence };
    delete without.rulingReactions;
    expect(EvidenceSchema.safeParse(without).success).toBe(false);
  });

  it('bounds a reaction beat at 1–4 lines', () => {
    const bounded = (lines: unknown[]) =>
      EvidenceSchema.safeParse({
        ...rawEvidence,
        rulingReactions: { ADMITTED: lines, EXCLUDED: [line] },
      }).success;
    expect(bounded([])).toBe(false);
    expect(bounded([line, line, line, line])).toBe(true);
    expect(bounded([line, line, line, line, line])).toBe(false);
  });

  it('rejects a COURT reaction speaker — the court never reacts to its own ruling', () => {
    const result = EvidenceSchema.safeParse({
      ...rawEvidence,
      rulingReactions: { ADMITTED: [{ speaker: 'COURT', text: 'So ordered.' }], EXCLUDED: [line] },
    });
    expect(result.success).toBe(false);
  });
});

describe('PleaNarrativeSchema (1D)', () => {
  it('accepts prosecutionRationale alone (defenseRationale optional)', () => {
    expect(PleaNarrativeSchema.safeParse({ prosecutionRationale: 'Strong case.' }).success).toBe(true);
  });

  it('accepts both rationales', () => {
    const result = PleaNarrativeSchema.safeParse({
      prosecutionRationale: 'Strong case.',
      defenseRationale: 'Worth the gamble.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty prosecutionRationale', () => {
    expect(PleaNarrativeSchema.safeParse({ prosecutionRationale: '' }).success).toBe(false);
  });

  it('rejects a prosecutionRationale over 1000 chars', () => {
    expect(PleaNarrativeSchema.safeParse({ prosecutionRationale: 'x'.repeat(1001) }).success).toBe(false);
  });

  it('accepts an optional allocution and bounds it at 800 chars', () => {
    const base = { prosecutionRationale: 'Strong case.', defenseRationale: 'Take the deal.' };
    expect(PleaNarrativeSchema.safeParse({ ...base, allocution: 'I want to say I am sorry.' }).success).toBe(true);
    expect(PleaNarrativeSchema.safeParse({ ...base, allocution: 'x'.repeat(801) }).success).toBe(false);
  });

  it('accepts optional pleaReactions keyed by the closed plea decisions', () => {
    const base = { prosecutionRationale: 'Strong case.', defenseRationale: 'Take the deal.' };
    const result = PleaNarrativeSchema.safeParse({
      ...base,
      pleaReactions: {
        ACCEPT: [{ speaker: 'CLERK', text: 'The plea is entered and accepted.' }],
        REJECT: [{ speaker: 'PROSECUTION', text: 'Then the People will prove it.' }],
      },
    });
    expect(result.success).toBe(true);
    // A reaction set missing one of the closed decisions is rejected.
    expect(PleaNarrativeSchema.safeParse({
      ...base,
      pleaReactions: { ACCEPT: [{ speaker: 'CLERK', text: 'Entered.' }] },
    }).success).toBe(false);
  });
});

describe('CaseSchema after pleaPosture removal (1D)', () => {
  it('parses a valid case that has no pleaPosture field', () => {
    expect(CasePayloadSchema.safeParse(rawValidCase).success).toBe(true);
  });

  it('rejects a case carrying an extra pleaPosture key (strictObject)', () => {
    const withPosture = {
      ...rawValidCase,
      pleaPosture: { status: 'NO_OFFER', prosecutionRationale: 'Declined.' },
    };
    expect(CasePayloadSchema.safeParse(withPosture).success).toBe(false);
  });

  it('still rejects duplicate charge ids', () => {
    const dupCharge = {
      ...rawValidCase,
      charges: [rawValidCase.charges[0], rawValidCase.charges[0]],
    };
    expect(CasePayloadSchema.safeParse(dupCharge).success).toBe(false);
  });

  it('still rejects evidence referencing an unknown targetElementId', () => {
    const danglingRef = {
      ...rawValidCase,
      evidence: [
        { ...rawValidCase.evidence[0], targetElementId: 'does-not-exist' },
        rawValidCase.evidence[1],
        rawValidCase.evidence[2],
      ],
    };
    expect(CasePayloadSchema.safeParse(danglingRef).success).toBe(false);
  });

  it('rejects a case missing statementOfFacts', () => {
    const withoutFacts: Record<string, unknown> = { ...rawValidCase };
    delete withoutFacts.statementOfFacts;
    expect(CasePayloadSchema.safeParse(withoutFacts).success).toBe(false);
  });

  it('rejects a case missing closingArguments', () => {
    const withoutClosings: Record<string, unknown> = { ...rawValidCase };
    delete withoutClosings.closingArguments;
    expect(CasePayloadSchema.safeParse(withoutClosings).success).toBe(false);
  });

  it('rejects legacy case-level sentencing fields (ranges are per-charge now)', () => {
    const legacy = {
      ...rawValidCase,
      mandatoryMinimums: [],
      maximumPenalties: [{ type: 'PRISON', unit: 'YEARS', amount: 10 }],
    };
    expect(CasePayloadSchema.safeParse(legacy).success).toBe(false);
  });
});
