import { useGameStore } from '../../store/useGameStore';
import { EvidenceListItem } from './EvidenceListItem';
import { WitnessListItem } from './WitnessListItem';
import type { MotionRuling } from '../../schemas/gameSchemas';

export function EvidenceTestimonyPanel() {
  const activeCase = useGameStore((state) => state.activeCase);
  const motionRulings = useGameStore((state) => state.motionRulings);

  if (!activeCase) return null;

  const rulingByEvidenceId = new Map<string, MotionRuling['ruling']>(
    motionRulings.map((r) => [r.evidenceId, r.ruling])
  );

  return (
    <nav aria-label="Evidence and testimony" className="flex flex-col gap-5 p-4">
      <div>
        <h2 className="text-sm font-medium text-(--text-muted)">Evidence</h2>
        <ul className="mt-1">
          {activeCase.evidence.map((evidence) => (
            <EvidenceListItem
              key={evidence.id}
              evidence={evidence}
              ruling={rulingByEvidenceId.get(evidence.id) ?? null}
            />
          ))}
        </ul>
      </div>

      <div>
        <h2 className="text-sm font-medium text-(--text-muted)">Witnesses</h2>
        <ul className="mt-1">
          {activeCase.witnesses.map((witness) => (
            <WitnessListItem key={witness.id} witness={witness} />
          ))}
        </ul>
      </div>
    </nav>
  );
}
