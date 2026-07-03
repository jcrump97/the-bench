import { useUIStore } from '../../store/useUIStore';
import { Badge } from '../common/Badge';
import { enumLabel } from '../../lib/format';
import type { CasePayload, MotionRuling } from '../../schemas/gameSchemas';

type Evidence = CasePayload['evidence'][number];

const RULING_TONE = { ADMITTED: 'good', EXCLUDED: 'bad' } as const;

export function EvidenceListItem({ evidence, ruling }: { evidence: Evidence; ruling: MotionRuling['ruling'] | null }) {
  const openModal = useUIStore((state) => state.openModal);

  return (
    <li>
      <button
        type="button"
        onClick={() => openModal({ type: 'EVIDENCE', evidenceId: evidence.id })}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left hover:bg-(--bg-elevated)"
      >
        <span className="min-w-0">
          <span className="block truncate text-(--text)">{evidence.name}</span>
          <span className="block text-sm text-(--text-muted)">{enumLabel(evidence.type)}</span>
        </span>
        <Badge tone={ruling ? RULING_TONE[ruling] : 'warn'}>{ruling ? enumLabel(ruling) : 'Pending'}</Badge>
      </button>
    </li>
  );
}
