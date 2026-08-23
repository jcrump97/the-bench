import { describe, it, expect } from 'vitest';
import { classifyOutcome } from '../outcome';
import type { Verdict } from '../../schemas/gameSchemas';

describe('classifyOutcome', () => {
  const guilty = (chargeId: string) => ({ chargeId, chargeName: 'X', classification: 'FELONY' as const, verdict: 'GUILTY' as const });
  const notGuilty = (chargeId: string) => ({ chargeId, chargeName: 'X', classification: 'FELONY' as const, verdict: 'NOT_GUILTY' as const });

  it('classifies an accepted plea regardless of verdict', () => {
    expect(classifyOutcome('ACCEPT', null)).toBe('PLEA_ACCEPTED');
  });

  it('classifies all-guilty as CONVICTED, all-not-guilty as ACQUITTED, mixed as SPLIT', () => {
    expect(classifyOutcome('REJECT', [guilty('a')])).toBe('CONVICTED');
    expect(classifyOutcome(null, [notGuilty('a')])).toBe('ACQUITTED');
    expect(classifyOutcome(null, [guilty('a'), notGuilty('b')])).toBe('SPLIT');
  });

  it('throws on the off-path call (no accepted plea and no verdict)', () => {
    expect(() => classifyOutcome(null, null)).toThrow();
    expect(() => classifyOutcome('REJECT', [] as unknown as Verdict)).toThrow();
  });
});
