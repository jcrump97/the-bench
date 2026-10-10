import { useEffect, useState, type FormEvent } from 'react';
import { BookOpen } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { useUIStore } from '../../store/useUIStore';
import { useSecurityStore } from '../../store/useSecurityStore';
import { DEMO_CASES, type DemoCaseBundle } from '../../lib/demoCases';
import { demoCaseSource } from '../../lib/caseSource';
import { createLazyGameService } from '../../lib/llm/lazyGameService';
import type { CaseSource } from '../../lib/caseSource';
import {
  applyGenerationProgress,
  initialGenerationProgress,
  GenerationCancelledError,
  type GenerateCaseOptions,
  type GenerationProgress,
} from '../../lib/generationProgress';
import { BenchRecordPanel } from '../result/BenchRecordPanel';
import { GenerationProgressPanel } from './GenerationProgressPanel';
import { ModalRoot } from '../modals/ModalRoot';

// A BYOK generation in flight: its cancel handle, when it began, and how far
// the pipeline has got. Local view state — it never outlives this screen.
interface GenerationRun {
  controller: AbortController;
  startedAt: number;
  progress: GenerationProgress;
}

export function WelcomeScreen() {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [run, setRun] = useState<GenerationRun | null>(null);

  const setActiveCase = useGameStore((state) => state.setActiveCase);
  const setActivePleaNarrative = useGameStore((state) => state.setActivePleaNarrative);
  const setPhase = useGameStore((state) => state.setPhase);
  const resetBeatCursor = useUIStore((state) => state.resetBeatCursor);
  const setLastGenerationError = useUIStore((state) => state.setLastGenerationError);
  const clearLastGenerationError = useUIStore((state) => state.clearLastGenerationError);
  const openModal = useUIStore((state) => state.openModal);
  const closeModal = useUIStore((state) => state.closeModal);

  // The docket opens with nothing over it. The Bench Book is the one modal
  // that renders without a case, so one left open in the courtroom — say,
  // opened while an aftermath call was running, which then failed into the
  // Mistrial screen (which renders no modals) — would otherwise pop back up
  // over the docket the moment the player returned, unasked.
  useEffect(() => {
    closeModal();
  }, [closeModal]);

  const vault = useSecurityStore((state) => state.vault);
  const setVault = useSecurityStore((state) => state.setVault);
  const isAuthenticated = useSecurityStore((state) => state.isAuthenticated);

  // Shared by both the demo bundles and a live BYOK generation — either way,
  // the store's Zod setters are the validation boundary. The `generating`
  // guard also blocks a second case from starting while a BYOK generation
  // (several seconds, multiple real Gemini calls) is still in flight: without
  // it, clicking a demo case mid-generation lets the demo path resolve first
  // and enter ACT_1_INTAKE, then the earlier BYOK generateCase() resolves
  // into a phase that no longer allows case rehydration and forces
  // ERROR_STATE — destroying the game the player already started.
  //
  // A cancelled run is abandoned, not awaited: once its signal is aborted,
  // whatever it later resolves or rejects with is ignored, so a case the
  // player walked away from can never land on top of the docket — or on top
  // of the next case they chose instead.
  const startCase = (source: CaseSource, options: GenerateCaseOptions = {}) => {
    if (generating) return;
    setGenerating(true);
    clearLastGenerationError();
    const abandoned = () => options.signal?.aborted === true;
    void source
      .generateCase(options)
      .then(({ payload, pleaNarrative }) => {
        if (abandoned()) return;
        setActiveCase(payload);
        setActivePleaNarrative(pleaNarrative);
        resetBeatCursor();
        setPhase('ACT_1_INTAKE');
      })
      .catch((err: unknown) => {
        if (abandoned() || err instanceof GenerationCancelledError) return;
        console.error('[GameService] generateCase failed:', err);
        setLastGenerationError({
          stage: 'generateCase',
          message: err instanceof Error ? err.message : String(err),
        });
        setPhase('ERROR_STATE');
      })
      .finally(() => {
        if (abandoned()) return;
        setGenerating(false);
        setRun(null);
      });
  };

  const handlePlayDemo = (bundle: DemoCaseBundle) => startCase(demoCaseSource(bundle));

  const handlePlayGenerated = () => {
    if (generating || vault === null || vault.isDemo) return;
    const controller = new AbortController();
    setRun({ controller, startedAt: Date.now(), progress: initialGenerationProgress() });
    startCase(createLazyGameService(vault.apiKey), {
      signal: controller.signal,
      onProgress: (event) =>
        setRun((current) =>
          current?.controller === controller
            ? { ...current, progress: applyGenerationProgress(current.progress, event) }
            : current,
        ),
    });
  };

  const handleCancelGeneration = () => {
    run?.controller.abort();
    setRun(null);
    setGenerating(false);
  };

  const handleSubmitKey = (event: FormEvent) => {
    event.preventDefault();
    setVault({ isDemo: false, apiKey: apiKeyInput });
    setSubmitted(true);
  };

  const authenticated = isAuthenticated();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-(--bg) px-4 text-center">
      <div>
        <h1 className="text-3xl font-semibold text-(--text-h)">The Bench</h1>
        <p className="mt-2 max-w-md text-(--text)">
          You are the judge. Rule on a plea deal, weigh the evidence, and deliver a verdict.
        </p>
        <button
          type="button"
          onClick={() => openModal({ type: 'BENCH_BOOK' })}
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm text-(--accent) hover:bg-(--bg-elevated)"
        >
          <BookOpen size={16} aria-hidden />
          New to the courtroom? Open the Bench Book
        </button>
      </div>

      <BenchRecordPanel />

      <div className="w-full max-w-lg rounded-lg border border-(--border) bg-(--bg-panel) p-5 text-left">
        <h2 className="text-sm font-medium text-(--text-h)">Today&apos;s Docket</h2>
        <p className="mt-1 text-sm text-(--text-muted)">
          {DEMO_CASES.length} cases await your ruling. No API key required — pick a file to take the bench.
        </p>
        <ul className="mt-3 space-y-2">
          {DEMO_CASES.map((bundle) => (
            <li key={bundle.id}>
              <button
                type="button"
                disabled={generating}
                onClick={() => handlePlayDemo(bundle)}
                className="min-h-11 w-full rounded-md border border-(--border-strong) px-4 py-3 text-left hover:bg-(--bg-elevated) disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="block text-xs text-(--text-muted)">
                  No. {bundle.id} &middot; {bundle.payload.charges.map((charge) => charge.name).join(' · ')}
                </span>
                <span className="mt-0.5 block font-medium text-(--text-h)">
                  {bundle.title}
                  {bundle.tutorial !== undefined && (
                    <span className="ml-2 rounded-full bg-(--accent-bg) px-2 py-0.5 text-xs font-medium text-(--accent)">
                      Start here
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-sm text-(--text)">{bundle.teaser}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="w-full max-w-sm rounded-lg border border-(--border) bg-(--bg-panel) p-5 text-left">
        <h2 className="text-sm font-medium text-(--text-h)">Bring Your Own Key</h2>

        {run !== null ? (
          <GenerationProgressPanel progress={run.progress} startedAt={run.startedAt} onCancel={handleCancelGeneration} />
        ) : authenticated && vault?.isDemo === false ? (
          <div className="mt-3 space-y-3">
            <p className="text-(--status-admitted)">Key accepted.</p>
            <button
              type="button"
              disabled={generating}
              onClick={handlePlayGenerated}
              className="min-h-11 w-full rounded-md border border-(--border-strong) px-4 py-2 text-(--text-h) hover:bg-(--bg-elevated) disabled:cursor-not-allowed disabled:text-(--text-muted)"
            >
              Generate a Case
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmitKey} className="mt-3 space-y-3">
            <input
              type="password"
              value={apiKeyInput}
              onChange={(event) => setApiKeyInput(event.target.value)}
              placeholder="Gemini API key"
              className="min-h-11 w-full rounded-md border border-(--border) bg-(--bg-elevated) px-3 py-2 text-(--text) focus:border-(--focus-ring)"
            />
            {submitted && !authenticated && (
              <p className="text-(--status-excluded)">
                Invalid API key. Gemini keys start with &quot;AIza&quot; and are at least 30 characters.
              </p>
            )}
            <button
              type="submit"
              className="min-h-11 w-full rounded-md border border-(--border-strong) px-4 py-2 text-(--text-h) hover:bg-(--bg-elevated)"
            >
              Submit Key
            </button>
          </form>
        )}
      </div>

      {/* Only the Bench Book can open here — every other modal needs a case. */}
      <ModalRoot />
    </div>
  );
}
