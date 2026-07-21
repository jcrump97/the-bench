import { useState } from 'react';
import type { Sentence } from '../../schemas/gameSchemas';
import { floorAmountFor } from '../../lib/sentenceBounds';
import { enumLabel } from '../../lib/format';

interface SentencePickerProps {
  maximums: Sentence[];
  minimums: Sentence[];
  amounts: number[];
  onAmountChange: (index: number, amount: number) => void;
}

export function SentencePicker({ maximums, minimums, amounts, onAmountChange }: SentencePickerProps) {
  return (
    <ul className="space-y-2">
      {maximums.map((max, index) => {
        const floor = floorAmountFor(max, minimums);
        return (
          <li key={index} className="flex flex-wrap items-center gap-2">
            <label className="flex-1 text-(--text)" htmlFor={`sentence-${index}`}>
              {enumLabel(max.type)} ({enumLabel(max.unit)})
            </label>
            <SentenceAmountField
              id={`sentence-${index}`}
              floor={floor}
              ceiling={max.amount}
              amount={amounts[index] ?? max.amount}
              onCommit={(amount) => onAmountChange(index, amount)}
            />
            <span className="text-sm text-(--text-muted)">
              {floor}–{max.amount}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// Clamping on every keystroke (the previous behavior) fights mobile numeric
// keypads: re-rendering the input with the just-clamped extreme mid-edit
// means the next digit lands on top of that extreme instead of the number
// the player meant to build, so the value snaps to the floor/ceiling and
// won't move (reported on Android Chrome). Editing instead happens against
// a local draft string — only a complete in-range number propagates live;
// blur reconciles the draft to whatever ended up committed.
function SentenceAmountField({
  id,
  floor,
  ceiling,
  amount,
  onCommit,
}: {
  id: string;
  floor: number;
  ceiling: number;
  amount: number;
  onCommit: (amount: number) => void;
}) {
  const [draft, setDraft] = useState(String(amount));

  return (
    <input
      id={id}
      type="number"
      inputMode="numeric"
      min={floor}
      max={ceiling}
      value={draft}
      onChange={(event) => {
        const raw = event.target.value;
        setDraft(raw);
        const parsed = Number(raw);
        if (raw.trim() !== '' && Number.isInteger(parsed) && parsed >= floor && parsed <= ceiling) {
          onCommit(parsed);
        }
      }}
      onBlur={() => {
        const parsed = Number(draft);
        const clamped = draft.trim() !== '' && Number.isInteger(parsed)
          ? Math.min(ceiling, Math.max(floor, parsed))
          : amount;
        setDraft(String(clamped));
        if (clamped !== amount) onCommit(clamped);
      }}
      className="min-h-11 w-24 rounded-md border border-(--border) bg-(--bg-elevated) px-3 py-1 text-right text-(--text-h) focus:border-(--focus-ring)"
    />
  );
}
