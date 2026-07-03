import type { ReactNode } from 'react';

type Tone = 'neutral' | 'good' | 'bad' | 'warn';

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'text-(--text) bg-(--bg-panel) border-(--border)',
  good: 'text-(--status-admitted) bg-(--status-admitted-bg) border-transparent',
  bad: 'text-(--status-excluded) bg-(--status-excluded-bg) border-transparent',
  warn: 'text-(--status-pending) bg-(--status-pending-bg) border-transparent',
};

interface BadgeProps {
  tone: Tone;
  children: ReactNode;
}

export function Badge({ tone, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-medium whitespace-nowrap ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
