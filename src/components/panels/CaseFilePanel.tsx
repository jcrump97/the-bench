import { useGameStore } from '../../store/useGameStore';
import { useUIStore } from '../../store/useUIStore';
import { useRevealState } from '../../hooks/useRevealState';
import { ChargeListItem } from './ChargeListItem';
import { enumLabel } from '../../lib/format';

// The judge holds the case file, so the defendant and the scene are always
// visible — but charges appear only as the clerk reads them, and the victim
// shortcut only once that witness has been disclosed in discovery.
export function CaseFilePanel() {
  const activeCase = useGameStore((state) => state.activeCase);
  const openModal = useUIStore((state) => state.openModal);
  const reveal = useRevealState();

  if (!activeCase) return null;

  const readCharges = activeCase.charges.filter((c) => reveal.charges.has(c.id));
  const victim = activeCase.witnesses.find(
    (w) => w.role === 'VICTIM' && reveal.witnesses.has(w.id),
  );

  return (
    <nav aria-label="Case file" className="flex flex-col gap-5 p-4">
      <div>
        <h2 className="text-sm font-medium text-(--text-muted)">Case</h2>
        <p className="mt-1 text-(--text-h)">{activeCase.caseId}</p>
      </div>

      <div>
        <h2 className="text-sm font-medium text-(--text-muted)">Charges</h2>
        {readCharges.length === 0 ? (
          <p className="mt-1 text-sm text-(--text-muted)">No charges have been read.</p>
        ) : (
          <ul className="mt-1">
            {readCharges.map((charge) => (
              <ChargeListItem key={charge.id} charge={charge} />
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="text-sm font-medium text-(--text-muted)">Defendant</h2>
        <button
          type="button"
          onClick={() => openModal({ type: 'DEFENDANT' })}
          className="mt-1 flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left hover:bg-(--bg-elevated)"
        >
          <span className="text-(--text)">
            {activeCase.defendant.firstName} {activeCase.defendant.lastName}
          </span>
          <span className="text-sm text-(--text-muted)">Age {activeCase.defendant.age}</span>
        </button>
      </div>

      {victim && (
        <div>
          <h2 className="text-sm font-medium text-(--text-muted)">Victim</h2>
          <button
            type="button"
            onClick={() => openModal({ type: 'WITNESS', witnessId: victim.id })}
            className="mt-1 flex min-h-11 w-full items-center rounded-md px-2 py-2 text-left text-(--text) hover:bg-(--bg-elevated)"
          >
            {victim.name}
          </button>
        </div>
      )}

      <div>
        <h2 className="text-sm font-medium text-(--text-muted)">Scene</h2>
        <button
          type="button"
          onClick={() => openModal({ type: 'EVENT' })}
          className="mt-1 min-h-11 w-full rounded-md px-2 py-2 text-left hover:bg-(--bg-elevated)"
        >
          <span className="text-sm text-(--text-muted)">
            {enumLabel(activeCase.environment.locationType)} &middot; {enumLabel(activeCase.environment.timeOfDay)}
          </span>
          <span className="mt-1 block text-(--text)">{activeCase.environment.description}</span>
        </button>
      </div>
    </nav>
  );
}
