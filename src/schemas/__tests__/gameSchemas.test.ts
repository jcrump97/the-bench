import { describe, it, expect } from 'vitest';
import { CasePayloadSchema, ChargeSchema, PleaNarrativeSchema } from '../gameSchemas';
import { rawValidCase } from '../../lib/__tests__/fixtures';

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

  it('rejects legacy case-level sentencing fields (ranges are per-charge now)', () => {
    const legacy = {
      ...rawValidCase,
      mandatoryMinimums: [],
      maximumPenalties: [{ type: 'PRISON', unit: 'YEARS', amount: 10 }],
    };
    expect(CasePayloadSchema.safeParse(legacy).success).toBe(false);
  });
});
