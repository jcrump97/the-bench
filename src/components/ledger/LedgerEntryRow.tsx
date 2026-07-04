import type { LedgerEntry, LedgerSpeaker } from '../../lib/buildLedger';

const SPEAKER_LABELS: Record<LedgerSpeaker, string> = {
  CLERK: 'Clerk of the Court',
  PROSECUTION: 'The People',
  DEFENSE: 'Defense Counsel',
  COURT: 'The Court',
  PRESS: 'Press',
};

export function LedgerEntryRow({ entry }: { entry: LedgerEntry }) {
  return (
    <li className="rounded-lg border border-(--border) bg-(--bg-panel) p-4">
      <p className="text-xs tracking-wide text-(--text-muted) uppercase">{SPEAKER_LABELS[entry.speaker]}</p>
      <h3 className="mt-0.5 text-sm font-medium text-(--text-h)">{entry.heading}</h3>
      <p className="mt-1 text-(--text)">{entry.body}</p>
    </li>
  );
}
