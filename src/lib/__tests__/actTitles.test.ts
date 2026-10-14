import { describe, it, expect } from 'vitest';
import { actTitleFor } from '../actTitles';

describe('actTitleFor', () => {
  it('titles every phase of the proceeding', () => {
    for (const phase of ['ACT_1_INTAKE', 'ACT_2_MOTIONS', 'ACT_3_VERDICT', 'END_STATE'] as const) {
      expect(actTitleFor(phase, null)?.label).toBeTruthy();
    }
  });

  it('titles nothing outside the courtroom', () => {
    expect(actTitleFor('WELCOME', null)).toBeNull();
    expect(actTitleFor('ERROR_STATE', null)).toBeNull();
  });

  // The plea path skips trial entirely, so "Verdict & Sentencing" would
  // promise a verdict the player is never asked for.
  it('calls Act 3 sentencing alone on the plea path', () => {
    expect(actTitleFor('ACT_3_VERDICT', 'ACCEPT')?.label).toBe('Act 3 — Sentencing');
    expect(actTitleFor('ACT_3_VERDICT', 'REJECT')?.label).toBe('Act 3 — Verdict & Sentencing');
    expect(actTitleFor('ACT_3_VERDICT', null)?.label).toBe('Act 3 — Verdict & Sentencing');
  });
});
