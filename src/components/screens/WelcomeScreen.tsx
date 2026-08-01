import { useState, type FormEvent } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useUIStore } from '../../store/useUIStore';
import { useSecurityStore } from '../../store/useSecurityStore';
import { DEMO_CASES, type DemoCaseBundle } from '../../lib/demoCases';
import { demoCaseSource } from '../../lib/caseSource';

export function WelcomeScreen() {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const setActiveCase = useGameStore((state) => state.setActiveCase);
  const setActivePleaNarrative = useGameStore((state) => state.setActivePleaNarrative);
  const setPhase = useGameStore((state) => state.setPhase);
  const resetBeatCursor = useUIStore((state) => state.resetBeatCursor);

  const vault = useSecurityStore((state) => state.vault);
  const setVault = useSecurityStore((state) => state.setVault);
  const isAuthenticated = useSecurityStore((state) => state.isAuthenticated);

  // [LLM-FILL: CasePayload + PleaNarrative] — on the BYOK path, a GameService-
  // backed CaseSource produces the payload and plea narrative through this
  // same async seam; the demo source stands in for it today. The store's Zod
  // setters remain the validation boundary either way.
  const handlePlayDemo = (bundle: DemoCaseBundle) => {
    void demoCaseSource(bundle)
      .generateCase()
      .then(({ payload, pleaNarrative }) => {
        setActiveCase(payload);
        setActivePleaNarrative(pleaNarrative);
        resetBeatCursor();
        setPhase('ACT_1_INTAKE');
      })
      .catch(() => setPhase('ERROR_STATE'));
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
      </div>

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
                onClick={() => handlePlayDemo(bundle)}
                className="min-h-11 w-full rounded-md border border-(--border-strong) px-4 py-3 text-left hover:bg-(--bg-elevated)"
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

        {authenticated && vault?.isDemo === false ? (
          <div className="mt-3 space-y-3">
            <p className="text-(--status-admitted)">Key accepted.</p>
            <button
              type="button"
              disabled
              title="Case generation coming soon"
              className="min-h-11 w-full cursor-not-allowed rounded-md border border-(--border-strong) px-4 py-2 text-(--text-muted)"
            >
              Continue — Case generation coming soon
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
    </div>
  );
}
