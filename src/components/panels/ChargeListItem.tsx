import { useUIStore } from '../../store/useUIStore';
import { Badge } from '../common/Badge';
import { enumLabel } from '../../lib/format';
import type { Charge } from '../../schemas/gameSchemas';

const CLASSIFICATION_TONE = {
  FELONY: 'bad',
  MISDEMEANOR: 'warn',
  INFRACTION: 'neutral',
} as const;

export function ChargeListItem({ charge }: { charge: Charge }) {
  const openModal = useUIStore((state) => state.openModal);

  return (
    <li>
      <button
        type="button"
        onClick={() => openModal({ type: 'CHARGE', chargeId: charge.id })}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left hover:bg-(--bg-elevated)"
      >
        <span className="text-(--text)">{charge.name}</span>
        <Badge tone={CLASSIFICATION_TONE[charge.classification]}>{enumLabel(charge.classification)}</Badge>
      </button>
    </li>
  );
}
