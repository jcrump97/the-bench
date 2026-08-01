import { useUIStore } from '../../store/useUIStore';
import { Badge } from '../common/Badge';
import { enumLabel } from '../../lib/format';
import type { RevealTier } from '../../lib/reveal';
import type { CasePayload } from '../../schemas/gameSchemas';

type Witness = CasePayload['witnesses'][number];

export function WitnessListItem({ witness, tier }: { witness: Witness; tier: RevealTier }) {
  const openModal = useUIStore((state) => state.openModal);

  return (
    <li>
      <button
        type="button"
        onClick={() => openModal({ type: 'WITNESS', witnessId: witness.id })}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left hover:bg-(--bg-elevated)"
      >
        <span className="min-w-0">
          <span className="block truncate text-(--text)">{witness.name}</span>
          <span className="block text-sm text-(--text-muted)">{enumLabel(witness.role)}</span>
        </span>
        {tier === 'PRESENTED' ? (
          <Badge tone={witness.role === 'VICTIM' ? 'bad' : 'neutral'}>{enumLabel(witness.bias)}</Badge>
        ) : (
          <Badge tone="neutral">Disclosed</Badge>
        )}
      </button>
    </li>
  );
}
