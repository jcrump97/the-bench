import { useGameStore } from '../../store/useGameStore';

// Phase-aware switch. Each case is a stub until Phase 4 lands its form:
// ACT_1_INTAKE → PleaOfferForm, ACT_2_MOTIONS → MotionRulingForm,
// ACT_3_VERDICT → PleaSentencingForm | TrialVerdictForm, END_STATE → ResultActions.
export function ActionBar() {
  const currentPhase = useGameStore((state) => state.currentPhase);

  switch (currentPhase) {
    case 'ACT_1_INTAKE':
      return <p className="text-(--text-muted)">Plea ruling coming in Phase 4.</p>;
    case 'ACT_2_MOTIONS':
      return <p className="text-(--text-muted)">Motion rulings coming in Phase 4.</p>;
    case 'ACT_3_VERDICT':
      return <p className="text-(--text-muted)">Verdict &amp; sentencing coming in Phase 4.</p>;
    case 'END_STATE':
      return <p className="text-(--text-muted)">Result actions coming in Phase 4.</p>;
    default:
      return null;
  }
}
