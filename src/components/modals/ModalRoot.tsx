import { lazy, Suspense } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useUIStore } from '../../store/useUIStore';
import { ChargeDetailModal } from './ChargeDetailModal';
import { EvidenceDetailModal } from './EvidenceDetailModal';
import { WitnessDetailModal } from './WitnessDetailModal';
import { DefendantDossierModal } from './DefendantDossierModal';
import { EventSummaryModal } from './EventSummaryModal';
import { Modal } from './Modal';

// Reference copy most players open rarely or never, so it is fetched on first
// open rather than shipped in the main chunk. That fetch can fail — most
// often a tab opened before a redeploy, asking for a chunk hash that no longer
// exists — and React.lazy rethrows a failed load during render, where (with
// no error boundary above it) it would unmount the whole app mid-case. A
// failed load renders a modal that says so instead; the case is untouched.
const BenchBookModal = lazy(() =>
  import('./BenchBookModal').then(
    (m) => ({ default: m.BenchBookModal }),
    () => ({ default: BenchBookUnavailable }),
  ),
);

function BenchBookUnavailable() {
  const closeModal = useUIStore((state) => state.closeModal);
  return (
    <Modal title="Bench Book" onClose={closeModal}>
      <div data-bench-book-unavailable className="space-y-2 text-(--text)">
        <p>The Bench Book could not be loaded. The site may have been updated since this page was opened.</p>
        <p className="text-sm text-(--text-muted)">
          Reloading fetches the current version — but it also returns you to the docket, so finish the case in front
          of you first.
        </p>
      </div>
    </Modal>
  );
}

export function ModalRoot() {
  const activeModal = useUIStore((state) => state.activeModal);
  const activeCase = useGameStore((state) => state.activeCase);

  if (activeModal === null) return null;
  if (activeModal.type === 'BENCH_BOOK') {
    return (
      <Suspense fallback={null}>
        <BenchBookModal />
      </Suspense>
    );
  }
  if (activeCase === null) return null;

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
