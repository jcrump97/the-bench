import { useGameStore } from '../../store/useGameStore';
import { useUIStore } from '../../store/useUIStore';
import { ChargeDetailModal } from './ChargeDetailModal';
import { EvidenceDetailModal } from './EvidenceDetailModal';
import { WitnessDetailModal } from './WitnessDetailModal';
import { DefendantDossierModal } from './DefendantDossierModal';
import { EventSummaryModal } from './EventSummaryModal';

export function ModalRoot() {
  const activeModal = useUIStore((state) => state.activeModal);
  const activeCase = useGameStore((state) => state.activeCase);

  if (activeModal === null || activeCase === null) return null;

  switch (activeModal.type) {
    case 'CHARGE':
      return <ChargeDetailModal chargeId={activeModal.chargeId} />;
    case 'EVIDENCE':
      return <EvidenceDetailModal evidenceId={activeModal.evidenceId} />;
    case 'WITNESS':
      return <WitnessDetailModal witnessId={activeModal.witnessId} />;
    case 'DEFENDANT':
      return <DefendantDossierModal />;
    case 'EVENT':
      return <EventSummaryModal />;
  }
}
