import { useGameStore } from '../../store/useGameStore';
import { useUIStore } from '../../store/useUIStore';
import { Modal } from './Modal';
import { Badge } from '../common/Badge';
import { enumLabel } from '../../lib/format';

interface WitnessDetailModalProps {
  witnessId: string;
}

export function WitnessDetailModal({ witnessId }: WitnessDetailModalProps) {
  const activeCase = useGameStore((state) => state.activeCase);
  const closeModal = useUIStore((state) => state.closeModal);

  const witness = activeCase?.witnesses.find((w) => w.id === witnessId);
  if (!activeCase || !witness) return null;

  return (
    <Modal title={witness.name} onClose={closeModal}>
      <div className="flex flex-wrap gap-2">
        <Badge tone={witness.role === 'VICTIM' ? 'bad' : 'neutral'}>{enumLabel(witness.role)}</Badge>
        <Badge tone="neutral">{enumLabel(witness.bias)} Bias</Badge>
      </div>
      <p className="mt-4 text-(--text)">{witness.statement}</p>
      <p className="mt-4 text-(--text-muted)">Credibility: {witness.credibilityScore} / 10</p>
    </Modal>
  );
}
