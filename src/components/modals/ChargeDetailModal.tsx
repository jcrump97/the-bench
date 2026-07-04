import { useGameStore } from '../../store/useGameStore';
import { useUIStore } from '../../store/useUIStore';
import { Modal } from './Modal';
import { Badge } from '../common/Badge';
import { SentenceList } from '../common/SentenceList';
import { enumLabel } from '../../lib/format';
import type { CasePayload, MotionRuling } from '../../schemas/gameSchemas';

const CLASSIFICATION_TONE = {
  FELONY: 'bad',
  MISDEMEANOR: 'warn',
  INFRACTION: 'neutral',
} as const;

function isElementSupported(activeCase: CasePayload, motionRulings: MotionRuling[], elementId: string): boolean {
  return activeCase.evidence.some((evidence) => {
    if (evidence.targetElementId !== elementId) return false;
    return motionRulings.find((r) => r.evidenceId === evidence.id)?.ruling === 'ADMITTED';
  });
}

interface ChargeDetailModalProps {
  chargeId: string;
}

export function ChargeDetailModal({ chargeId }: ChargeDetailModalProps) {
  const activeCase = useGameStore((state) => state.activeCase);
  const motionRulings = useGameStore((state) => state.motionRulings);
  const closeModal = useUIStore((state) => state.closeModal);

  const charge = activeCase?.charges.find((c) => c.id === chargeId);
  if (!activeCase || !charge) return null;

  return (
    <Modal title={charge.name} onClose={closeModal}>
      <Badge tone={CLASSIFICATION_TONE[charge.classification]}>{enumLabel(charge.classification)}</Badge>
      <ul className="mt-4 space-y-3">
        {charge.elements.map((element) => (
          <li key={element.id} className="flex items-start justify-between gap-3">
            <span className="text-(--text)">{element.description}</span>
            <Badge tone={isElementSupported(activeCase, motionRulings, element.id) ? 'good' : 'neutral'}>
              {isElementSupported(activeCase, motionRulings, element.id) ? 'Supported' : 'Unsupported'}
            </Badge>
          </li>
        ))}
      </ul>

      <h3 className="mt-5 text-sm font-medium text-(--text-h)">Sentencing Range</h3>
      <h4 className="mt-2 text-sm text-(--text-muted)">Mandatory Minimums</h4>
      {charge.mandatoryMinimums.length === 0 ? (
        <p className="text-(--text)">None</p>
      ) : (
        <SentenceList sentences={charge.mandatoryMinimums} />
      )}
      <h4 className="mt-3 text-sm text-(--text-muted)">Maximum Penalties</h4>
      <SentenceList sentences={charge.maximumPenalties} />
    </Modal>
  );
}
