import type { ReactNode } from 'react';

interface PanelToggleButtonProps {
  label: string;
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}

export function PanelToggleButton({ label, pressed, onClick, children }: PanelToggleButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`flex h-11 w-11 items-center justify-center rounded-md hover:text-(--text-h) ${
        pressed ? 'text-(--accent)' : 'text-(--text-muted)'
      }`}
    >
      {children}
    </button>
  );
}
