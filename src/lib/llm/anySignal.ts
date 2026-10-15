// One signal that aborts when any of its inputs does, with the abort reason of
// whichever fired first. AbortSignal.any is newer than everything else this
// app relies on — Safari before 17.4 lacks it — and the transport combines
// signals on every request, so without this fallback every BYOK request there
// would throw before it was sent, not just the cancelled ones.
//
// The fallback's listeners live on the input signals, and the player's cancel
// signal outlives every request made under it, so each attempt would leave one
// behind. `release` detaches them; callers call it once the combined signal is
// no longer needed. The native path has nothing to detach.
export interface CombinedSignal {
  signal: AbortSignal;
  release: () => void;
}

export function anySignal(signals: AbortSignal[]): CombinedSignal {
  if (typeof AbortSignal.any === 'function') {
    return { signal: AbortSignal.any(signals), release: () => {} };
  }
  const controller = new AbortController();
  const detach: (() => void)[] = [];
  const release = () => {
    for (const off of detach.splice(0)) off();
  };
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    const onAbort = () => {
      controller.abort(signal.reason);
      release();
    };
    signal.addEventListener('abort', onAbort, { once: true });
    detach.push(() => signal.removeEventListener('abort', onAbort));
  }
  if (controller.signal.aborted) release();
  return { signal: controller.signal, release };
}
