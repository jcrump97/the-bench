// One signal that aborts when any of its inputs does, with the abort reason of
// whichever fired first. AbortSignal.any is newer than everything else this
// app relies on — Safari before 17.4 lacks it — and the transport combines
// signals on every request, so without this fallback every BYOK request there
// would throw before it was sent, not just the cancelled ones.
export function anySignal(signals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(signals);
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}
