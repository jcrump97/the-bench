import { describe, it, expect } from 'vitest';
import { CasePayloadSchema, PleaNarrativeSchema } from '../gameSchemas';
import { rawValidCase } from '../../lib/__tests__/fixtures';

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

  it('rejects a mandatoryMinimums entry with no matching-type maximumPenalties entry', () => {
    const noMatchingMax = {
      ...rawValidCase,
      mandatoryMinimums: [{ type: 'FINE', unit: 'DOLLARS', amount: 500 }],
    };
    expect(CasePayloadSchema.safeParse(noMatchingMax).success).toBe(false);
  });

  it('rejects a mandatoryMinimums entry that exceeds its matching maximumPenalties entry', () => {
    const minExceedsMax = {
      ...rawValidCase,
      mandatoryMinimums: [{ type: 'PRISON', unit: 'YEARS', amount: 11 }],
    };
    expect(CasePayloadSchema.safeParse(minExceedsMax).success).toBe(false);
  });

  it('accepts a mandatoryMinimums entry equal to its matching maximumPenalties entry', () => {
    const minEqualsMax = {
      ...rawValidCase,
      mandatoryMinimums: [{ type: 'PRISON', unit: 'YEARS', amount: 10 }],
    };
    expect(CasePayloadSchema.safeParse(minEqualsMax).success).toBe(true);
  });
});
