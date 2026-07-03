import { Fragment } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useUIStore } from '../../store/useUIStore';
import { Modal } from './Modal';
import { enumLabel } from '../../lib/format';

export function EventSummaryModal() {
  const activeCase = useGameStore((state) => state.activeCase);
  const closeModal = useUIStore((state) => state.closeModal);

  if (!activeCase) return null;
  const { environment } = activeCase;

  return (
    <Modal title="Case Summary" onClose={closeModal}>
      <div className="flex flex-wrap gap-2 text-sm text-(--text-muted)">
        <span>{enumLabel(environment.locationType)}</span>
        <span>&middot;</span>
        <span>{enumLabel(environment.timeOfDay)}</span>
        {environment.weather !== 'N/A' && (
          <Fragment>
            <span>&middot;</span>
            <span>{enumLabel(environment.weather)}</span>
          </Fragment>
        )}
      </div>
      <p className="mt-3 text-(--text)">{environment.description}</p>

      <h3 className="mt-5 text-sm font-medium text-(--text-h)">Summary</h3>
      <p className="mt-1 text-(--text)">{activeCase.summary}</p>

      <h3 className="mt-5 text-sm font-medium text-(--text-h)">Statutory Context</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        {activeCase.statuteContexts.map((context, index) => (
          <li key={index} className="text-(--text)">
            {context}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
