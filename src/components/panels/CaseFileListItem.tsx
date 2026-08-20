import type { ReactNode } from 'react';

// One row of a case-file panel: a full-width tap target that opens the item's
// detail modal, a label with an optional second line, and a trailing badge.
// The three list items (charge, exhibit, witness) differ only in what they put
// in those slots — the chrome, the 44px minimum touch height, and the hover
// treatment were copied between them.
//
// `truncateLabel` is not a style preference. Exhibit and witness names are
// long and repetitive ("Doorbell-camera acquisition report"), so eliding them
// to one line keeps the panel scannable and the detail modal carries the rest.
// A charge name is the count itself and wraps instead, because "Driving on a
// Su…" tells the judge nothing about what the defendant is answering for.
export function CaseFileListItem({
  onOpen,
  label,
  sublabel,
  badge,
  truncateLabel = false,
}: {
  onOpen: () => void;
  label: string;
  sublabel?: string;
  badge: ReactNode;
  truncateLabel?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left hover:bg-(--bg-elevated)"
      >
        {/* min-w-0 only alongside truncation: it is what lets a flex child
            shrink below its min-content width, which is meaningless (and lets
            a long word overflow) when the text is allowed to wrap. */}
        <span className={truncateLabel ? 'min-w-0' : undefined}>
          <span className={truncateLabel ? 'block truncate text-(--text)' : 'text-(--text)'}>
            {label}
          </span>
          {sublabel !== undefined && (
            <span className="block text-sm text-(--text-muted)">{sublabel}</span>
          )}
        </span>
        {badge}
      </button>
    </li>
  );
}
