import { useEffect, useRef, type ReactNode } from 'react';
import { LedgerEntryRow } from './LedgerEntryRow';
import type { StatementBeat } from '../../lib/courtroomScript';

// Presentational: the revealed transcript comes in via props (from
// useCourtroomScript in the shell); this component never touches the stores.
// The full history stays scrollable; the view keeps itself pinned to the
// newest beat as the record grows.
//
// `footer` is anything filed under the record but not spoken into it — today
// the closing minute order. It renders above the scroll pin on purpose: the
// pin marks the true bottom of the record, so whatever closes the case lands
// on screen with the beat that produced it instead of just below the fold.
export function Ledger({ entries, footer }: { entries: StatementBeat[]; footer?: ReactNode }) {
  const newestRef = useRef<HTMLDivElement>(null);
  const newestId = entries.at(-1)?.id;

  useEffect(() => {
    if (newestId === undefined) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    newestRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'end' });
  }, [newestId]);

  if (entries.length === 0) {
    return <p className="text-(--text-muted)">The courtroom is seated. The record is empty.</p>;
  }

  return (
    <>
      <ol aria-label="Court record" className="space-y-2.5">
        {entries.map((entry) => (
          <LedgerEntryRow key={entry.id} entry={entry} isNewest={entry.id === newestId} />
        ))}
      </ol>
      {footer}
      <div ref={newestRef} aria-hidden="true" />
    </>
  );
}
