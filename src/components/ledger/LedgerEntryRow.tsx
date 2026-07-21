import type { StatementBeat, StatementEntryKind, LedgerSpeaker } from '../../lib/courtroomScript';

// The party a beat is attributed to when no individual is named. Witnesses and
// the allocuting defendant override this with their own name (speakerName).
const SPEAKER_LABELS: Record<LedgerSpeaker, string> = {
  CLERK: 'Clerk of the Court',
  PROSECUTION: 'The People',
  DEFENSE: 'Defense Counsel',
  WITNESS: 'Witness',
  COURT: 'The Court',
  PRESS: 'Press',
};

// Each party speaks in its own accent, leading its utterances in the record.
const SPEAKER_ACCENT: Record<LedgerSpeaker, string> = {
  CLERK: 'var(--speaker-clerk)',
  PROSECUTION: 'var(--speaker-prosecution)',
  DEFENSE: 'var(--speaker-defense)',
  WITNESS: 'var(--speaker-witness)',
  COURT: 'var(--speaker-court)',
  PRESS: 'var(--speaker-press)',
};

// The court's rulings carry a heading that is real content — the structural
// outcome, kept visible per the script's heading invariant. The heading leads
// these beats (it already names the court); no separate speaker line.
const OUTCOME_KINDS = new Set<StatementEntryKind>([
  'PLEA_DECISION',
  'MOTION_RULING',
  'VERDICT',
  'SENTENCE_IMPOSED',
]);

// The record's turning points — their outcome heading carries the most weight.
const HEAVY_KINDS = new Set<StatementEntryKind>(['VERDICT', 'SENTENCE_IMPOSED']);

// A reaction's heading restates its own speaker ("The People Respond" over a
// line already led by The People), so the speaker lead alone carries it.
const REACTION_KINDS = new Set<StatementEntryKind>([
  'PLEA_REACTION',
  'MOTION_REACTION',
  'VERDICT_REACTION',
]);

// A name-led beat's heading repeats the name it leads with; caption it with
// concise stage direction instead. Every beat carrying a speakerName is one of
// these kinds.
const NAME_LED_CAPTIONS: Partial<Record<StatementEntryKind, string>> = {
  TESTIMONY_DIRECT: 'Direct examination',
  TESTIMONY_CROSS: 'Cross-examination',
  ALLOCUTION: 'Allocution',
};

// One beat of the court record, rendered as courtroom speech rather than a
// summary card: the speaker leads the line, the editorial heading is demoted to
// stage direction (or dropped where the speaker says it), and a per-speaker
// accent runs down the margin so exchanges read as a dialogue. Two beats stand
// apart from the flowing testimony: the court's rulings (heading-led, on a
// panel) and the press aftermath (a clipping).
export function LedgerEntryRow({ entry, isNewest }: { entry: StatementBeat; isNewest: boolean }) {
  const accent = SPEAKER_ACCENT[entry.speaker];
  // beat-in only animates on mount; older entries keep their identity (and
  // their stillness) because their keys never change.
  const enter = isNewest ? 'beat-in' : '';

  if (entry.entryKind === 'AFTERMATH') {
    return (
      <li
        data-speaker={entry.speaker}
        data-entry-kind={entry.entryKind}
        className={`rounded-r border-l-2 bg-(--bg-elevated) p-4 ${enter}`}
        style={{ borderColor: accent }}
      >
        <p className="text-xs tracking-widest text-(--text-muted) uppercase">In the Press</p>
        <h3 className="mt-1 font-medium text-(--text-h)">{entry.heading}</h3>
        <p className="mt-1 text-(--text) italic">{entry.body}</p>
      </li>
    );
  }

  if (OUTCOME_KINDS.has(entry.entryKind)) {
    const heading = HEAVY_KINDS.has(entry.entryKind)
      ? 'text-base font-semibold'
      : 'text-sm font-medium';
    return (
      <li
        data-speaker={entry.speaker}
        data-entry-kind={entry.entryKind}
        className={`rounded-r border-l-2 bg-(--bg-panel) py-2 pr-3 pl-3 ${enter}`}
        style={{ borderColor: accent }}
      >
        <h3 className={`text-(--text-h) ${heading}`}>{entry.heading}</h3>
        <p className="mt-1 text-(--text)">{entry.body}</p>
      </li>
    );
  }

  // Flowing speech: witness testimony, the attorneys' arguments and reactions,
  // the clerk's readings. Lead with who is speaking; caption with the demoted
  // heading unless the speaker already says it (a reaction) or the heading just
  // repeats the name it leads with (name-led testimony/allocution).
  const speaker = entry.speakerName ?? SPEAKER_LABELS[entry.speaker];
  const caption = entry.speakerName !== undefined
    ? NAME_LED_CAPTIONS[entry.entryKind]
    : REACTION_KINDS.has(entry.entryKind)
      ? undefined
      : entry.heading;

  return (
    <li
      data-speaker={entry.speaker}
      data-entry-kind={entry.entryKind}
      className={`border-l-2 py-1 pl-3 ${enter}`}
      style={{ borderColor: accent }}
    >
      <p className="text-sm font-semibold" style={{ color: accent }}>{speaker}</p>
      {caption !== undefined && (
        <p className="mt-0.5 text-xs text-(--text-muted)">{caption}</p>
      )}
      <p className="mt-1 text-(--text)">{entry.body}</p>
    </li>
  );
}
