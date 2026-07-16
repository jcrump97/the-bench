import { useGameStore } from '../../store/useGameStore';
import { useCourtroomScript } from '../../hooks/useCourtroomScript';
import { ContinueControl } from './ContinueControl';
import { PleaRulingControl } from './PleaRulingControl';
import { MotionRulingControl } from './MotionRulingControl';
import { ChargeVerdictControl } from './ChargeVerdictControl';
import { SentencingControl } from './SentencingControl';
import { ResultActions } from './ResultActions';

// Beat-aware switch: the control for whatever the script is waiting on — a
// Continue for the next statement, the matching decision control at a pause,
// and the case-closed actions once the record is complete.
export function ActionBar() {
  const currentPhase = useGameStore((state) => state.currentPhase);
  const view = useCourtroomScript();
  const pending = view.pendingBeat;

  if (pending === undefined) {
    // Script exhausted: only a completed case ends without a pending beat.
    return currentPhase === 'END_STATE' ? <ResultActions /> : null;
  }

  if (pending.kind === 'STATEMENT') {
    return <ContinueControl view={view} />;
  }

  switch (pending.decision.type) {
    case 'PLEA_RULING':
      return <PleaRulingControl hasOffer={pending.decision.hasOffer} />;
    case 'MOTION_RULING':
      return <MotionRulingControl evidenceId={pending.decision.evidenceId} />;
    case 'CHARGE_VERDICT':
      return <ChargeVerdictControl chargeId={pending.decision.chargeId} />;
    case 'SENTENCING':
      return <SentencingControl anyGuilty={pending.decision.anyGuilty} />;
  }
}
