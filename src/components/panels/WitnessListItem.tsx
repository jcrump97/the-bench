import { useUIStore } from '../../store/useUIStore';
import { Badge } from '../common/Badge';
import { CaseFileListItem } from './CaseFileListItem';
import { enumLabel } from '../../lib/format';
import type { RevealTier } from '../../lib/reveal';
import type { CasePayload } from '../../schemas/gameSchemas';

type Witness = CasePayload['witnesses'][number];

export function WitnessListItem({ witness, tier }: { witness: Witness; tier: RevealTier }) {
  const openModal = useUIStore((state) => state.openModal);

  return (
    <CaseFileListItem
      onOpen={() => openModal({ type: 'WITNESS', witnessId: witness.id })}
      label={witness.name}
      truncateLabel
      sublabel={enumLabel(witness.role)}
      badge={
        tier === 'PRESENTED' ? (
          <Badge tone={witness.role === 'VICTIM' ? 'bad' : 'neutral'}>{enumLabel(witness.bias)}</Badge>
        ) : (
          <Badge tone="neutral">Disclosed</Badge>
        )
      }
    />
  );
}
