import { useEffect, useState } from 'react';
import { CircleCheck, CircleDashed, CircleMinus, LoaderCircle } from 'lucide-react';
import {
  GENERATION_STEPS,
  type GenerationProgress,
  type GenerationStepKind,
  type StepProgress,
} from '../../lib/generationProgress';

const KIND_LABEL: Record<GenerationStepKind, string> = {
  MODEL: 'model call',
  COMPUTED: 'computed',
};

function seconds(ms: number): string {
  return `${(Math.max(0, ms) / 1000).toFixed(1)}s`;
}

// A clock that ticks while something is running, so elapsed times move
// without the pipeline having to report anything.
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function StepIcon({ status }: { status: StepProgress['status'] }) {
  switch (status) {
    case 'DONE':
      return <CircleCheck size={16} className="text-(--status-admitted)" aria-hidden />;
    case 'RUNNING':
      return <LoaderCircle size={16} className="animate-spin text-(--accent) motion-reduce:animate-none" aria-hidden />;
    case 'SKIPPED':
      return <CircleMinus size={16} className="text-(--text-muted)" aria-hidden />;
    case 'PENDING':
      return <CircleDashed size={16} className="text-(--text-muted)" aria-hidden />;
  }
}

function stepTime(step: StepProgress, now: number): string | null {
  if (step.status === 'DONE' && step.startedAt !== null && step.finishedAt !== null) {
    return seconds(step.finishedAt - step.startedAt);
  }
  if (step.status === 'RUNNING' && step.startedAt !== null) return seconds(now - step.startedAt);
  return null;
}

interface GenerationProgressPanelProps {
  progress: GenerationProgress;
  startedAt: number;
  onCancel: () => void;
}

// The BYOK generating screen: the pipeline drawn as it runs. Each row is a
// step GameService reports — a Gemini call, or a deterministic derivation the
// model never touches — so the split the architecture is built on is visible
// while the player waits, rather than hidden behind a spinner.
export function GenerationProgressPanel({ progress, startedAt, onCancel }: GenerationProgressPanelProps) {
  const now = useNow(250);
  const finished = GENERATION_STEPS.filter((step) => {
    const { status } = progress[step.id];
    return status === 'DONE' || status === 'SKIPPED';
  }).length;

  return (
    <section data-generation-progress className="mt-3 space-y-3" aria-label="Case generation progress">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-(--text-h)">Drafting your case…</p>
        <p className="font-mono text-xs text-(--text-muted)" aria-live="off">{seconds(now - startedAt)}</p>
      </div>
      <p className="text-xs text-(--text-muted)">
        Model calls write the people and their words. Computed steps decide the structure — the model never writes those.
      </p>

      <ol className="space-y-1.5" aria-live="polite" aria-relevant="text">
        {GENERATION_STEPS.map((step) => {
          const state = progress[step.id];
          const time = stepTime(state, now);
          return (
            <li key={step.id} data-step={step.id} data-status={state.status} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 shrink-0">
                <StepIcon status={state.status} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={state.status === 'PENDING' ? 'text-(--text-muted)' : 'text-(--text-h)'}>{step.label}</span>
                <span className="ml-2 rounded-sm border border-(--border) px-1 text-[0.7rem] text-(--text-muted)">
                  {KIND_LABEL[step.kind]}
                </span>
                {state.status === 'SKIPPED' && <span className="ml-2 text-xs text-(--text-muted)">not needed</span>}
                <span className="block text-xs text-(--text-muted)">{step.detail}</span>
              </span>
              {time !== null && <span className="shrink-0 font-mono text-xs text-(--text-muted)">{time}</span>}
            </li>
          );
        })}
      </ol>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-(--text-muted)">
          {finished} of {GENERATION_STEPS.length} steps
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-md border border-(--border-strong) px-4 py-2 text-(--text-h) hover:bg-(--bg-elevated)"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
