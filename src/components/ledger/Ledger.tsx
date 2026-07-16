import { useEffect, useRef } from 'react';
import { LedgerEntryRow } from './LedgerEntryRow';
import type { StatementBeat } from '../../lib/courtroomScript';

// Presentational: the revealed transcript comes in via props (from
// useCourtroomScript in the shell); this component never touches the stores.
// The full history stays scrollable; the view keeps itself pinned to the
// newest beat as the record grows.
export function Ledger({ entries }: { entries: StatementBeat[] }) {
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
      <ol aria-label="Court record" className="space-y-3">
        {entries.map((entry) => (
          <LedgerEntryRow key={entry.id} entry={entry} isNewest={entry.id === newestId} />
        ))}
      </ol>
      <div ref={newestRef} aria-hidden="true" />
    </>
  );
}
