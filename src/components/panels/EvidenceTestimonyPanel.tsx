import { useGameStore } from '../../store/useGameStore';
import { useRevealState } from '../../hooks/useRevealState';
import { EvidenceListItem } from './EvidenceListItem';
import { WitnessListItem } from './WitnessListItem';
import type { MotionRuling } from '../../schemas/gameSchemas';

// The panel lists only what has entered the record: items appear when
// counsel discloses them in Act 1 (Tier 1) and gain their full status once
// actually presented (Tier 2). Before the case is called, discovery is empty.
export function EvidenceTestimonyPanel() {
  const activeCase = useGameStore((state) => state.activeCase);
  const motionRulings = useGameStore((state) => state.motionRulings);
  const reveal = useRevealState();

  if (!activeCase) return null;

  const rulingByEvidenceId = new Map<string, MotionRuling['ruling']>(
    motionRulings.map((r) => [r.evidenceId, r.ruling])
  );
  const disclosedEvidence = activeCase.evidence.filter((e) => reveal.evidence.has(e.id));
  const disclosedWitnesses = activeCase.witnesses.filter((w) => reveal.witnesses.has(w.id));

  return (
    <nav aria-label="Evidence and testimony" className="flex flex-col gap-5 p-4">
      <div>
        <h2 className="text-sm font-medium text-(--text-muted)">Evidence</h2>
        {disclosedEvidence.length === 0 ? (
          <p className="mt-1 text-sm text-(--text-muted)">No discovery has been entered.</p>
        ) : (
          <ul className="mt-1">
            {disclosedEvidence.map((evidence) => (
              <EvidenceListItem
                key={evidence.id}
                evidence={evidence}
                tier={reveal.evidence.get(evidence.id) ?? 'DISCLOSED'}
                ruling={rulingByEvidenceId.get(evidence.id) ?? null}
              />
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="text-sm font-medium text-(--text-muted)">Witnesses</h2>
        {disclosedWitnesses.length === 0 ? (
          <p className="mt-1 text-sm text-(--text-muted)">No witnesses have been disclosed.</p>
        ) : (
          <ul className="mt-1">
            {disclosedWitnesses.map((witness) => (
              <WitnessListItem
                key={witness.id}
                witness={witness}
                tier={reveal.witnesses.get(witness.id) ?? 'DISCLOSED'}
              />
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
}
