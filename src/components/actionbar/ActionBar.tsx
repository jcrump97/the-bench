import { useGameStore } from '../../store/useGameStore';
import { PleaOfferForm } from './PleaOfferForm';
import { MotionRulingForm } from './MotionRulingForm';

// Phase-aware switch. Remaining stubs land in Phase 4:
// ACT_3_VERDICT → PleaSentencingForm | TrialVerdictForm, END_STATE → ResultActions.
export function ActionBar() {
  const currentPhase = useGameStore((state) => state.currentPhase);

  switch (currentPhase) {
    case 'ACT_1_INTAKE':
      return <PleaOfferForm />;
    case 'ACT_2_MOTIONS':
      return <MotionRulingForm />;
    case 'ACT_3_VERDICT':
      return <p className="text-(--text-muted)">Verdict &amp; sentencing coming in Phase 4.</p>;
    case 'END_STATE':
      return <p className="text-(--text-muted)">Result actions coming in Phase 4.</p>;
    default:
      return null;
  }
}
