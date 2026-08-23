import { useState } from 'react';
import { clearFinalResults, loadFinalResults } from '../../lib/resultArchive';
import { describeDisposition, summarizeRecord } from '../../lib/resultSummary';
import { formatJudgmentDate, formatSentenceList } from '../../lib/format';

const RECENT_SHOWN = 5;

// The judge's record, read back from the archive at the top of the docket
// screen: what the player has already decided, waiting for them the next time
// they sit down. Hidden entirely before the first case closes — a new player
// has no record and an empty scoreboard is not an invitation.
//
// Read once at mount rather than subscribed to: this screen only exists
// between cases, and resetGameState remounts it, so there is nothing to keep
// in sync while it is on screen.
export function BenchRecordPanel() {
  const [results, setResults] = useState(loadFinalResults);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const record = summarizeRecord(results);

  if (record.casesHeard === 0) return null;

  const stats: { label: string; value: string; note?: string }[] = [
    { label: 'Cases heard', value: String(record.casesHeard) },
    { label: 'Pleas taken', value: String(record.pleasAccepted) },
    { label: 'Trials held', value: String(record.trialsHeld) },
    record.guiltyRate === null
      ? { label: 'Counts guilty', value: '—', note: 'none tried' }
      : {
          label: 'Counts guilty',
          value: `${record.guiltyRate}%`,
          note: `${record.countsGuilty} of ${record.countsTried}`,
        },
  ];

  return (
    <div data-bench-record className="w-full max-w-lg rounded-lg border border-(--border) bg-(--bg-panel) p-5 text-left">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-(--text-h)">Your Bench Record</h2>
        <span data-bench-record-count className="text-sm text-(--text-muted)">
          {record.casesHeard} {record.casesHeard === 1 ? 'case' : 'cases'} decided
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-md border border-(--border) px-3 py-2">
            <dt className="text-xs text-(--text-muted)">{stat.label}</dt>
            <dd className="mt-0.5 font-medium text-(--text-h)">
              {stat.value}
              {stat.note !== undefined && (
                <span className="block text-xs font-normal text-(--text-muted)">{stat.note}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <ul className="mt-3 space-y-2">
        {results.slice(0, RECENT_SHOWN).map((result) => (
          <li key={`${result.caseId}-${result.completedAt}`} data-bench-record-entry className="text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="font-medium text-(--text-h)">People v. {result.defendantName}</span>
              <span className="text-xs text-(--text-muted)">
                No. {result.caseId} &middot; {formatJudgmentDate(result.completedAt)}
              </span>
            </div>
            <p className="text-(--text-muted)">
              {describeDisposition(result)} &middot; {formatSentenceList(result.imposedSentence).toLowerCase()}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between gap-3">
        {results.length > RECENT_SHOWN && (
          <span className="text-xs text-(--text-muted)">
            {results.length - RECENT_SHOWN} older {results.length - RECENT_SHOWN === 1 ? 'judgment' : 'judgments'} on file
          </span>
        )}
        {/* Two-step: wiping the record is the one destructive control on the
            screen, and it cannot be undone from anywhere in the app. */}
        <button
          type="button"
          onClick={() => {
            if (!confirmingClear) {
              setConfirmingClear(true);
              return;
            }
            clearFinalResults();
            setResults([]);
            setConfirmingClear(false);
          }}
          className="ml-auto min-h-11 rounded-md px-3 py-2 text-sm text-(--text-muted) hover:bg-(--bg-elevated) hover:text-(--text)"
        >
          {confirmingClear ? 'Confirm — erase the record' : 'Clear record'}
        </button>
      </div>
    </div>
  );
}
