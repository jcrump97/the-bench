import { useEffect, useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { actTitleFor } from '../../lib/actTitles';
import type { GamePhase } from '../../schemas/gameSchemas';

// How long a card stays up. Long enough to read two short lines, short
// enough that a player who already knows the act never waits on it.
const CARD_MS = 3200;

// The title card shown as each act opens. UI chrome laid over the courtroom,
// not a beat in it — the record stays a pure projection of validated state.
// It never blocks: pointer events pass straight through to the record and
// the action bar, so a player can keep clicking while it fades.
export function ActTitleCard() {
  const currentPhase = useGameStore((state) => state.currentPhase);
  const pleaDecision = useGameStore((state) => state.pleaDecision);
  // The phase whose card has finished showing. A phase change makes the card
  // visible again simply by no longer matching.
  const [shownPhase, setShownPhase] = useState<GamePhase | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setShownPhase(currentPhase), CARD_MS);
    return () => clearTimeout(timer);
  }, [currentPhase]);

  const title = actTitleFor(currentPhase, pleaDecision);
  if (title === null || shownPhase === currentPhase) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-30 flex justify-center px-4">
      <div
        key={currentPhase}
        data-act-card={currentPhase}
        role="status"
        className="act-card max-w-md rounded-lg border border-(--accent-border) bg-(--bg-elevated) px-5 py-3 text-center shadow-(--shadow)"
      >
        <p className="font-medium text-(--text-h)">{title.label}</p>
        <p className="mt-1 text-sm text-(--text)">{title.stakes}</p>
      </div>
    </div>
  );
}
