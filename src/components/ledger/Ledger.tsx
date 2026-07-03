import { LedgerEntryRow } from './LedgerEntryRow';
import type { LedgerEntry } from '../../lib/buildLedger';

// Presentational: entries come in via props (from useLedgerEntries in the
// shell); this component never touches the stores.
export function Ledger({ entries }: { entries: LedgerEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-(--text-muted)">The court record is empty.</p>;
  }

  return (
    <ol aria-label="Court record" className="space-y-3">
      {entries.map((entry) => (
        <LedgerEntryRow key={entry.id} entry={entry} />
      ))}
    </ol>
  );
}
