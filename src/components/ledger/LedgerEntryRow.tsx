import type { LedgerEntry } from '../../lib/buildLedger';

export function LedgerEntryRow({ entry }: { entry: LedgerEntry }) {
  return (
    <li className="rounded-lg border border-(--border) bg-(--bg-panel) p-4">
      <h3 className="text-sm font-medium text-(--text-h)">{entry.heading}</h3>
      <p className="mt-1 text-(--text)">{entry.body}</p>
    </li>
  );
}
