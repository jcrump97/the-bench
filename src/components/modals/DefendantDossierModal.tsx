import { useGameStore } from '../../store/useGameStore';
import { useUIStore } from '../../store/useUIStore';
import { Modal } from './Modal';
import { SentenceList } from '../common/SentenceList';
import { enumLabel } from '../../lib/format';
import { defendantFullName } from '../../schemas/gameSchemas';

export function DefendantDossierModal() {
  const activeCase = useGameStore((state) => state.activeCase);
  const closeModal = useUIStore((state) => state.closeModal);

  if (!activeCase) return null;
  const { defendant } = activeCase;

  return (
    <Modal title={defendantFullName(defendant)} onClose={closeModal}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-(--text-muted)">Age</dt>
        <dd className="text-(--text)">{defendant.age}</dd>
        <dt className="text-(--text-muted)">Relationship</dt>
        <dd className="text-(--text)">{enumLabel(defendant.demographics.relationshipStatus)}</dd>
        <dt className="text-(--text-muted)">Children</dt>
        <dd className="text-(--text)">{defendant.demographics.children}</dd>
        <dt className="text-(--text-muted)">Employment</dt>
        <dd className="text-(--text)">{enumLabel(defendant.demographics.employmentStatus)}</dd>
        <dt className="text-(--text-muted)">Education</dt>
        <dd className="text-(--text)">{enumLabel(defendant.demographics.educationLevel)}</dd>
      </dl>

      <h3 className="mt-5 text-sm font-medium text-(--text-h)">Substance History</h3>
      {defendant.demographics.substanceAbuseHistory.length === 0 ? (
        <p className="text-(--text-muted)">None reported</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {defendant.demographics.substanceAbuseHistory.map((entry, index) => (
            <li key={index} className="text-(--text)">
              {entry.substance} — {enumLabel(entry.status)}
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-5 text-sm font-medium text-(--text-h)">Past Convictions</h3>
      {defendant.pastConvictions.length === 0 ? (
        <p className="text-(--text-muted)">None</p>
      ) : (
        <ul className="mt-1 space-y-3">
          {defendant.pastConvictions.map((conviction, index) => (
            <li key={index}>
              <p className="text-(--text)">
                {conviction.chargeName} ({conviction.year})
              </p>
              <SentenceList sentences={conviction.sentences} />
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
