import type { ReactNode } from 'react';

interface PanelToggleButtonProps {
  label: string;
  pressed: boolean;
  // First-run affordance: pops the button while the panel hint plays.
  hint?: boolean;
  onClick: () => void;
  children: ReactNode;
}

export function PanelToggleButton({ label, pressed, hint = false, onClick, children }: PanelToggleButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`flex h-11 w-11 items-center justify-center rounded-md hover:text-(--text-h) ${
        pressed ? 'text-(--accent)' : 'text-(--text-muted)'
      } ${hint ? 'panel-hint-toggle' : ''}`}
    >
      {children}
    </button>
  );
}
