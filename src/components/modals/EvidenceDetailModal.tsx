import { useGameStore } from '../../store/useGameStore';
import { useUIStore } from '../../store/useUIStore';
import { Modal } from './Modal';
import { Badge } from '../common/Badge';
import { OBJECTION_RISK_TONE, RULING_TONE } from '../common/tones';
import { enumLabel } from '../../lib/format';
import { useRevealState } from '../../hooks/useRevealState';
import { defendantFullName, type CasePayload } from '../../schemas/gameSchemas';

interface EvidenceDetailModalProps {
  evidenceId: string;
}

export function EvidenceDetailModal({ evidenceId }: EvidenceDetailModalProps) {
  const activeCase = useGameStore((state) => state.activeCase);
  const motionRulings = useGameStore((state) => state.motionRulings);
  const closeModal = useUIStore((state) => state.closeModal);
  const reveal = useRevealState();

  const evidence = activeCase?.evidence.find((e) => e.id === evidenceId);
  if (!activeCase || !evidence) return null;

  // Defense in depth: an item that never entered the record has no detail
  // view at all, and a merely disclosed item shows only counsel's summary.
  const tier = reveal.evidence.get(evidence.id);
  if (tier === undefined) return null;
  if (tier === 'DISCLOSED') {
    return (
      <Modal title={evidence.name} onClose={closeModal}>
        <Badge tone="neutral">{enumLabel(evidence.type)}</Badge>
        <p className="mt-4 text-(--text)">{evidence.disclosureSummary}</p>
        <p className="mt-4 text-sm text-(--text-muted)">
          Disclosed in discovery — not yet presented to the court.
        </p>
      </Modal>
    );
  }

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
      {evidence.interrogation !== undefined && (
        <InterrogationTranscript
          interrogation={evidence.interrogation}
          defendantName={defendantFullName(activeCase.defendant)}
        />
      )}
    </Modal>
  );
}

// The full interview transcript, rendered as the recording's own dialogue.
function InterrogationTranscript({
  interrogation,
  defendantName,
}: {
  interrogation: NonNullable<CasePayload['evidence'][number]['interrogation']>;
  defendantName: string;
}) {
  return (
    <div>
      <h3 className="mt-5 text-sm font-medium text-(--text-h)">Interview Transcript</h3>
      <ul className="mt-2 space-y-2">
        {interrogation.lines.map((line, index) => (
          <li key={index}>
            <p className="text-xs font-semibold text-(--text-muted)">
              {line.speaker === 'DETECTIVE' ? interrogation.detectiveName : defendantName}
            </p>
            <p className="text-(--text)">{line.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
