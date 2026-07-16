import type { StatementBeat, LedgerSpeaker } from '../../lib/courtroomScript';

const SPEAKER_LABELS: Record<LedgerSpeaker, string> = {
  CLERK: 'Clerk of the Court',
  PROSECUTION: 'The People',
  DEFENSE: 'Defense Counsel',
  WITNESS: 'Witness',
  COURT: 'The Court',
  PRESS: 'Press',
};

export function LedgerEntryRow({ entry, isNewest }: { entry: StatementBeat; isNewest: boolean }) {
  return (
    // beat-in only animates on mount; older entries keep their identity (and
    // their stillness) because their keys never change.
    <li className={`rounded-lg border border-(--border) bg-(--bg-panel) p-4 ${isNewest ? 'beat-in' : ''}`}>
      <p className="text-xs tracking-wide text-(--text-muted) uppercase">{SPEAKER_LABELS[entry.speaker]}</p>
      <h3 className="mt-0.5 text-sm font-medium text-(--text-h)">{entry.heading}</h3>
      <p className="mt-1 text-(--text)">{entry.body}</p>
    </li>
  );
}
