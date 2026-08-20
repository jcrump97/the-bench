const OPTION_BUTTON = 'min-h-11 w-full rounded-md border px-4 py-2 text-left text-sm';

// The judge's voice control, shared by all three decision points (plea,
// evidentiary ruling, verdict). Each authored option is bound to a choice from
// a closed vocabulary, so picking a line can multiply the voice without ever
// widening the state space — the caller still owns what the choice *does*.
//
// The quote marks are decorative and aria-hidden: the line is already the
// button's accessible name, and screen readers announcing "quote ... unquote"
// around every option adds nothing.
export function JudgeLineOptions<Choice extends string>({
  options,
  styleFor,
  onChoose,
}: {
  options: readonly { choice: Choice; lineText: string }[];
  styleFor: (choice: Choice) => string;
  onChoose: (choice: Choice, lineText: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((option) => (
        <button
          key={option.lineText}
          type="button"
          // Structural hook for the E2E driver, which selects the ruling it
          // wants by choice rather than by matching authored prose.
          data-choice={option.choice}
          onClick={() => onChoose(option.choice, option.lineText)}
          className={`${OPTION_BUTTON} ${styleFor(option.choice)}`}
        >
          <span aria-hidden="true">&ldquo;</span>{option.lineText}<span aria-hidden="true">&rdquo;</span>
        </button>
      ))}
    </div>
  );
}
