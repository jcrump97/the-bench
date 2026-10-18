import { afterEach, describe, expect, it, vi } from 'vitest';
import { anySignal } from '../anySignal';

const nativeAny = AbortSignal.any;

describe('anySignal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(AbortSignal, 'any', { value: nativeAny, configurable: true, writable: true });
  });

  it('aborts with the reason of the first input to fire (native path)', () => {
    const a = new AbortController();
    const b = new AbortController();
    const { signal } = anySignal([a.signal, b.signal]);
    b.abort('second');
    expect(signal.aborted).toBe(true);
    expect(signal.reason).toBe('second');
  });

  describe('fallback without AbortSignal.any', () => {
    const withoutAny = () =>
      Object.defineProperty(AbortSignal, 'any', { value: undefined, configurable: true, writable: true });

    it('aborts with the reason of the first input to fire', () => {
      withoutAny();
      const a = new AbortController();
      const b = new AbortController();
      const { signal } = anySignal([a.signal, b.signal]);
      expect(signal.aborted).toBe(false);
      a.abort('first');
      b.abort('second');
      expect(signal.reason).toBe('first');
    });

    it('is born aborted when an input already is', () => {
      withoutAny();
      const a = new AbortController();
      a.abort('early');
      const { signal } = anySignal([new AbortController().signal, a.signal]);
      expect(signal.reason).toBe('early');
    });

    it('release detaches every listener it added', () => {
      withoutAny();
      const cancel = new AbortController();
      const remove = vi.spyOn(cancel.signal, 'removeEventListener');
      const { signal, release } = anySignal([cancel.signal, new AbortController().signal]);
      release();
      expect(remove).toHaveBeenCalledTimes(1);
      cancel.abort('late');
      expect(signal.aborted).toBe(false);
    });
  });
});
