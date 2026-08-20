import { useGameStore } from '../../store/useGameStore';
import { useUIStore } from '../../store/useUIStore';
import { JudgeLineOptions } from './JudgeLineOptions';

const ADMIT_STYLE = 'border-transparent bg-(--status-admitted-bg) text-(--status-not-guilty) hover:opacity-90';
const EXCLUDE_STYLE = 'border-(--border-strong) text-(--text) hover:bg-(--status-excluded-bg) hover:text-(--status-guilty)';

// One exhibit is before the court: the People have offered it and the defense
// has objected (or waived) in the record above. The judge rules by choosing
// the words spoken from the bench — each authored option is bound to a closed
// ruling, so the voice never changes the state space. The chosen line enters
// the record verbatim via spokenJudgeLines.
export function MotionRulingControl({ evidenceId }: { evidenceId: string }) {
  const activeCase = useGameStore((state) => state.activeCase);
  const motionRulings = useGameStore((state) => state.motionRulings);
  const addMotionRuling = useGameStore((state) => state.addMotionRuling);
  const recordSpokenJudgeLine = useGameStore((state) => state.recordSpokenJudgeLine);
  const advanceBeat = useUIStore((state) => state.advanceBeat);

  const evidence = activeCase?.evidence.find((e) => e.id === evidenceId);
  if (!activeCase || !evidence) return null;

  const rule = (ruling: 'ADMITTED' | 'EXCLUDED', lineText: string) => {
    recordSpokenJudgeLine(`motion-${evidenceId}`, lineText);
    addMotionRuling({ evidenceId, ruling });
    advanceBeat();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="min-w-0">
        <p className="text-xs text-(--text-muted)">
          Exhibit {motionRulings.length + 1} of {activeCase.evidence.length} — how does the court rule?
        </p>
        <h2 className="truncate font-medium text-(--text-h)">{evidence.name}</h2>
      </div>
      <JudgeLineOptions
        options={evidence.rulingOptions}
        styleFor={(choice) => (choice === 'ADMITTED' ? ADMIT_STYLE : EXCLUDE_STYLE)}
        onChoose={rule}
      />
    </div>
  );
}
