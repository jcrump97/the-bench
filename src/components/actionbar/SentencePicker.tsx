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
            <input
              id={`sentence-${index}`}
              type="number"
              min={floor}
              max={max.amount}
              value={amounts[index] ?? max.amount}
              onChange={(event) => {
                const parsed = Number(event.target.value);
                if (Number.isInteger(parsed)) {
                  onAmountChange(index, Math.min(max.amount, Math.max(floor, parsed)));
                }
              }}
              className="min-h-11 w-24 rounded-md border border-(--border) bg-(--bg-elevated) px-3 py-1 text-right text-(--text-h) focus:border-(--focus-ring) focus:outline-none"
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
