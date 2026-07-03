import { useGameStore } from '../../store/useGameStore';

export function ErrorScreen() {
  const setPhase = useGameStore((state) => state.setPhase);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-(--bg) px-4 text-center">
      <div>
        <h1 className="text-2xl font-semibold text-(--text-h)">Mistrial</h1>
        <p className="mt-2 max-w-md text-(--text)">
          Something went wrong and the case state could not be recovered. The proceedings have
          been vacated.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setPhase('WELCOME')}
        className="min-h-11 rounded-md bg-(--accent) px-6 py-3 font-medium text-(--bg) hover:opacity-90"
      >
        Return to Welcome
      </button>
    </div>
  );
}
