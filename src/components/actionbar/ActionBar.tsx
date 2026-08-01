import type { ReactNode } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useCourtroomScript } from '../../hooks/useCourtroomScript';
import { findDemoCaseById } from '../../lib/demoCases';
import { ContinueControl } from './ContinueControl';
import { PleaRulingControl } from './PleaRulingControl';
import { MotionRulingControl } from './MotionRulingControl';
import { ChargeVerdictControl } from './ChargeVerdictControl';
import { SentencingControl } from './SentencingControl';
import { ResultActions } from './ResultActions';
import type { ScriptBeat } from '../../lib/courtroomScript';

function controlFor(pending: ScriptBeat, view: ReturnType<typeof useCourtroomScript>): ReactNode {
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

// Beat-aware switch: the control for whatever the script is waiting on — a
// Continue for the next statement, the matching decision control at a pause,
// and the case-closed actions once the record is complete.
//
// A guided (tutorial) bundle additionally carries per-control explainers,
// looked up bundle-side by case id: presentation-tier text rendered above
// the active control. Non-tutorial and future LLM cases resolve to
// undefined and render nothing — no per-control changes anywhere.
export function ActionBar() {
  const currentPhase = useGameStore((state) => state.currentPhase);
  const activeCase = useGameStore((state) => state.activeCase);
  const view = useCourtroomScript();
  const pending = view.pendingBeat;

  if (pending === undefined) {
    // Script exhausted: only a completed case ends without a pending beat.
    return currentPhase === 'END_STATE' ? <ResultActions /> : null;
  }

  const explainers =
    activeCase !== null ? findDemoCaseById(activeCase.caseId)?.tutorial?.decisionExplainers : undefined;
  const explainer =
    explainers?.[pending.kind === 'STATEMENT' ? 'CONTINUE' : pending.decision.type];

  const control = controlFor(pending, view);
  if (explainer === undefined) return control;

  return (
    <div className="space-y-2">
      <p data-tutorial-explainer className="text-sm text-(--text-muted) italic">{explainer}</p>
      {control}
    </div>
  );
}
