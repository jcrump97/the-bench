import { useUIStore } from '../../store/useUIStore';
import { Badge } from '../common/Badge';
import { CaseFileListItem } from './CaseFileListItem';
import { CLASSIFICATION_TONE } from '../common/tones';
import { enumLabel } from '../../lib/format';
import type { Charge } from '../../schemas/gameSchemas';

export function ChargeListItem({ charge }: { charge: Charge }) {
  const openModal = useUIStore((state) => state.openModal);

  return (
    <CaseFileListItem
      onOpen={() => openModal({ type: 'CHARGE', chargeId: charge.id })}
      label={charge.name}
      badge={
        <Badge tone={CLASSIFICATION_TONE[charge.classification]}>
          {enumLabel(charge.classification)}
        </Badge>
      }
    />
  );
}
