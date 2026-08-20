import { useUIStore } from '../../store/useUIStore';
import { Badge } from '../common/Badge';
import { CaseFileListItem } from './CaseFileListItem';
import { RULING_TONE } from '../common/tones';
import { enumLabel } from '../../lib/format';
import type { RevealTier } from '../../lib/reveal';
import type { CasePayload, MotionRuling } from '../../schemas/gameSchemas';

type Evidence = CasePayload['evidence'][number];

export function EvidenceListItem({
  evidence,
  tier,
  ruling,
}: {
  evidence: Evidence;
  tier: RevealTier;
  ruling: MotionRuling['ruling'] | null;
}) {
  const openModal = useUIStore((state) => state.openModal);

  return (
    <CaseFileListItem
      onOpen={() => openModal({ type: 'EVIDENCE', evidenceId: evidence.id })}
      label={evidence.name}
      truncateLabel
      sublabel={enumLabel(evidence.type)}
      badge={
        tier === 'PRESENTED' ? (
          <Badge tone={ruling ? RULING_TONE[ruling] : 'warn'}>
            {ruling ? enumLabel(ruling) : 'Pending'}
          </Badge>
        ) : (
          <Badge tone="neutral">Disclosed</Badge>
        )
      }
    />
  );
}
