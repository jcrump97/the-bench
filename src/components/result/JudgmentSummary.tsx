import { Badge } from '../common/Badge';
import { SentenceList } from '../common/SentenceList';
import { enumLabel, formatJudgmentDate } from '../../lib/format';
import { describeDisposition, dispositionOf } from '../../lib/resultSummary';
import type { CaseOutcome } from '../../lib/outcome';
import type { FinalResult } from '../../schemas/gameSchemas';

// Keyed by the outcome union, so a new outcome is a type error here rather
// than an uncoloured badge.
const DISPOSITION_TONE: Record<CaseOutcome, 'neutral' | 'good' | 'bad' | 'warn'> = {
  PLEA_ACCEPTED: 'neutral',
  CONVICTED: 'bad',
  ACQUITTED: 'good',
  SPLIT: 'warn',
};

// The minute order: the clerk's one-page record of what the court actually
// did, rendered from the persisted FinalResult rather than from live state.
// It is the snapshot the record was filed under — if this and the transcript
// above it ever disagreed, this is the one that survived to localStorage.
export function JudgmentSummary({ result }: { result: FinalResult }) {
  const disposition = dispositionOf(result);
  const admitted = result.resolutionPath === 'TRIAL'
    ? result.motionRulings.filter((r) => r.ruling === 'ADMITTED').length
    : 0;

  return (
    <section
      data-judgment-summary
      data-disposition={disposition}
      className="mt-6 rounded-lg border border-(--border-strong) bg-(--bg-panel) p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium tracking-wide text-(--text-muted) uppercase">Minute Order</h2>
        <span className="text-xs text-(--text-muted)">
          No. {result.caseId} &middot; Filed {formatJudgmentDate(result.completedAt)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-semibold text-(--text-h)">People v. {result.defendantName}</h3>
        <Badge tone={DISPOSITION_TONE[disposition]}>{describeDisposition(result)}</Badge>
      </div>

      {result.resolutionPath === 'TRIAL' ? (
        <>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="text-(--text-muted)">Plea posture</dt>
              <dd className="text-(--text)">{enumLabel(result.pleaOutcome)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-(--text-muted)">Evidentiary rulings</dt>
              <dd className="text-(--text)">
                {admitted} admitted, {result.motionRulings.length - admitted} excluded
              </dd>
            </div>
          </dl>
          <ul className="mt-3 space-y-1">
            {result.verdict.map((count, index) => (
              <li key={count.chargeId} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-(--text-muted)">Count {index + 1}</span>
                <span className="text-(--text-h)">{count.chargeName}</span>
                <span className="text-(--text-muted)">({enumLabel(count.classification)})</span>
                <Badge tone={count.verdict === 'GUILTY' ? 'bad' : 'good'}>{enumLabel(count.verdict)}</Badge>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-3 text-sm text-(--text-muted)">
          Guilt established by plea; the court accepted the negotiated disposition.
        </p>
      )}

      <div className="mt-3">
        <h4 className="text-sm font-medium text-(--text-h)">Sentence</h4>
        <div className="mt-1 text-sm">
          <SentenceList sentences={result.imposedSentence} />
        </div>
      </div>

      <p className="mt-3 text-xs text-(--text-muted)">
        Filed to the judge&apos;s record. It will be waiting on the docket screen when this case is closed.
      </p>
    </section>
  );
}
