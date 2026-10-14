import type { GamePhase, PleaDecision } from '../schemas/gameSchemas';

// What each act of the proceeding is called, and what the judge decides in
// it. Presentation copy, not a courtroom beat: nobody in the courtroom says
// "Act 2", so this never enters the record — it titles the top bar and the
// card shown as an act opens, so a first-time player always knows where they
// are and what the next stretch of the record is for.
export interface ActTitle {
  label: string;
  stakes: string;
}

type ProceedingPhase = Exclude<GamePhase, 'WELCOME' | 'ERROR_STATE'>;

const ACT_TITLES: Record<ProceedingPhase, ActTitle> = {
  ACT_1_INTAKE: {
    label: 'Act 1 — Intake & Plea',
    stakes: 'The case is called and both sides disclose what they have. Then you rule on whether a plea ends it here.',
  },
  ACT_2_MOTIONS: {
    label: 'Act 2 — Evidentiary Motions',
    stakes: 'The People offer each exhibit and the defense may object. Only what you admit can be argued at trial.',
  },
  ACT_3_VERDICT: {
    label: 'Act 3 — Verdict & Sentencing',
    stakes: 'Witnesses testify and counsel close. You decide each count, then choose a sentence within the statutory range.',
  },
  END_STATE: {
    label: 'Aftermath',
    stakes: 'The record closes. What follows is what your rulings set in motion.',
  },
};

// The plea path reaches Act 3 with no trial to hold: the defendant has already
// pleaded, so the act is allocution and sentence alone.
const PLEA_PATH_ACT_3: ActTitle = {
  label: 'Act 3 — Sentencing',
  stakes: 'The plea stands. The defendant may address the court, and you choose a sentence within the statutory range.',
};

export function actTitleFor(phase: GamePhase, pleaDecision: PleaDecision | null): ActTitle | null {
  if (phase === 'WELCOME' || phase === 'ERROR_STATE') return null;
  if (phase === 'ACT_3_VERDICT' && pleaDecision === 'ACCEPT') return PLEA_PATH_ACT_3;
  return ACT_TITLES[phase];
}
