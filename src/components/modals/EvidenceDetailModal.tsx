import { useGameStore } from '../../store/useGameStore';
import { useUIStore } from '../../store/useUIStore';
import { Modal } from './Modal';
import { Badge } from '../common/Badge';
import { enumLabel } from '../../lib/format';

const OBJECTION_RISK_TONE = { LOW: 'good', MEDIUM: 'warn', HIGH: 'bad' } as const;
const RULING_TONE = { ADMITTED: 'good', EXCLUDED: 'bad' } as const;

interface EvidenceDetailModalProps {
  evidenceId: string;
}

export function EvidenceDetailModal({ evidenceId }: EvidenceDetailModalProps) {
  const activeCase = useGameStore((state) => state.activeCase);
  const motionRulings = useGameStore((state) => state.motionRulings);
  const closeModal = useUIStore((state) => state.closeModal);

  const evidence = activeCase?.evidence.find((e) => e.id === evidenceId);
  if (!activeCase || !evidence) return null;

  const targetElement =
    evidence.targetElementId === null
      ? null
      : (activeCase.charges.flatMap((c) => c.elements).find((el) => el.id === evidence.targetElementId) ?? null);
  const ruling = motionRulings.find((r) => r.evidenceId === evidence.id)?.ruling ?? null;

  return (
    <Modal title={evidence.name} onClose={closeModal}>
      <div className="flex flex-wrap gap-2">
        <Badge tone="neutral">{enumLabel(evidence.type)}</Badge>
        <Badge tone={OBJECTION_RISK_TONE[evidence.objectionRisk]}>{enumLabel(evidence.objectionRisk)} Objection Risk</Badge>
        <Badge tone={ruling ? RULING_TONE[ruling] : 'warn'}>{ruling ? enumLabel(ruling) : 'No ruling yet'}</Badge>
      </div>
      <p className="mt-4 text-(--text)">{evidence.description}</p>
      <p className="mt-4 text-(--text-muted)">
        Target element: {targetElement ? targetElement.description : 'None'}
      </p>
    </Modal>
  );
}
