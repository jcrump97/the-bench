import { useGameStore } from '../../store/useGameStore';
import { PleaOfferForm } from './PleaOfferForm';
import { MotionRulingForm } from './MotionRulingForm';
import { PleaSentencingForm } from './PleaSentencingForm';
import { TrialVerdictForm } from './TrialVerdictForm';

// Phase-aware switch. Remaining stub lands in Phase 4:
// END_STATE → ResultActions.
export function ActionBar() {
  const currentPhase = useGameStore((state) => state.currentPhase);
  const pleaDecision = useGameStore((state) => state.pleaDecision);

  switch (currentPhase) {
    case 'ACT_1_INTAKE':
      return <PleaOfferForm />;
    case 'ACT_2_MOTIONS':
      return <MotionRulingForm />;
    // The accepted-plea path has no verdict step (FinalResultSchema's PLEA
    // branch carries no verdict); only the trial path reads motion rulings.
    case 'ACT_3_VERDICT':
      return pleaDecision === 'ACCEPT' ? <PleaSentencingForm /> : <TrialVerdictForm />;
    case 'END_STATE':
      return <p className="text-(--text-muted)">Result actions coming in Phase 4.</p>;
    default:
      return null;
  }
}
