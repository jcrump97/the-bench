import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useSecurityStore } from '../useSecurityStore';

// ===========================================================================
// The BYOK vault.
//
// This is the smallest store and the only one holding a secret, and it had no
// tests at all. Its two guarantees are what the rest of the app leans on:
// setVault fails *closed* (a payload that does not parse leaves no vault
// behind, rather than a partially-trusted one), and isAuthenticated is the
// gate the UI routes on.
//
// The key itself is memory-only by design — never localStorage, never
// sessionStorage, never a cookie. That invariant is asserted at the bottom.
// ===========================================================================

// A fixture, not a credential. Deliberately 34 characters rather than 39:
// a real Gemini key is `AIza` plus exactly 35 more, and secret scanners match
// on that shape — an earlier version of this line was 39 characters and
// tripped GitHub's Google API Key detector on a string that never existed
// outside this file. It still satisfies BYOKSchema (AIza prefix, >= 30 chars),
// which is all these tests need.
const VALID_KEY = 'AIzaNotARealKey_ExampleOnly_000000';

beforeEach(() => {
  useSecurityStore.getState().clearVault();
});

describe('useSecurityStore — setVault', () => {
  it('accepts a well-formed live key', () => {
    useSecurityStore.getState().setVault({ isDemo: false, apiKey: VALID_KEY });
    expect(useSecurityStore.getState().vault).toEqual({ isDemo: false, apiKey: VALID_KEY });
  });

  it('accepts a demo vault carrying no key', () => {
    useSecurityStore.getState().setVault({ isDemo: true });
    expect(useSecurityStore.getState().vault).toEqual({ isDemo: true });
  });

  const REJECTED: [label: string, payload: unknown][] = [
    ['a key that is too short', { isDemo: false, apiKey: 'AIzaTooShort' }],
    ['a key without the AIza prefix', { isDemo: false, apiKey: 'sk-live-0123456789012345678901234567890' }],
    ['a live vault with no key at all', { isDemo: false }],
    ['a demo vault that smuggles a key alongside', { isDemo: true, apiKey: VALID_KEY }],
    ['a vault with no isDemo discriminant', { apiKey: VALID_KEY }],
    ['an unknown extra field', { isDemo: false, apiKey: VALID_KEY, scope: 'admin' }],
    ['null', null],
    ['a bare string', VALID_KEY],
  ];

  for (const [label, payload] of REJECTED) {
    it(`fails closed on ${label}`, () => {
      useSecurityStore.getState().setVault(payload);
      expect(useSecurityStore.getState().vault).toBeNull();
      expect(useSecurityStore.getState().isAuthenticated()).toBe(false);
    });
  }

  it('a rejected payload clears a vault that was already good', () => {
    // The dangerous case: a failed re-auth must not leave the previous
    // session's key in place.
    useSecurityStore.getState().setVault({ isDemo: false, apiKey: VALID_KEY });
    expect(useSecurityStore.getState().isAuthenticated()).toBe(true);

    useSecurityStore.getState().setVault({ isDemo: false, apiKey: 'nope' });
    expect(useSecurityStore.getState().vault).toBeNull();
    expect(useSecurityStore.getState().isAuthenticated()).toBe(false);
  });
});

describe('useSecurityStore — isAuthenticated', () => {
  it('is false with no vault', () => {
    expect(useSecurityStore.getState().isAuthenticated()).toBe(false);
  });

  it('is true for a live key', () => {
    useSecurityStore.getState().setVault({ isDemo: false, apiKey: VALID_KEY });
    expect(useSecurityStore.getState().isAuthenticated()).toBe(true);
  });

  it('is true for demo mode, which is the point of demo mode', () => {
    useSecurityStore.getState().setVault({ isDemo: true });
    expect(useSecurityStore.getState().isAuthenticated()).toBe(true);
  });
});

describe('useSecurityStore — clearVault', () => {
  it('wipes a live vault', () => {
    useSecurityStore.getState().setVault({ isDemo: false, apiKey: VALID_KEY });
    useSecurityStore.getState().clearVault();
    expect(useSecurityStore.getState().vault).toBeNull();
    expect(useSecurityStore.getState().isAuthenticated()).toBe(false);
  });

  it('is safe to call on an already-empty vault', () => {
    expect(() => useSecurityStore.getState().clearVault()).not.toThrow();
    expect(useSecurityStore.getState().vault).toBeNull();
  });
});

describe('useSecurityStore — the key never leaves memory', () => {
  // The suite runs in the `node` environment, where neither storage global
  // exists. Install recording stubs so "nothing was written" is a fact this
  // test establishes rather than an accident of the environment — without
  // them the assertions below would pass no matter what the store did.
  function installStorageSpies() {
    const writes: [store: string, key: string, value: string][] = [];
    const stub = (name: string) => ({
      setItem: (key: string, value: string) => void writes.push([name, key, value]),
      getItem: () => null,
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    });
    vi.stubGlobal('localStorage', stub('localStorage'));
    vi.stubGlobal('sessionStorage', stub('sessionStorage'));
    return writes;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes the key to neither localStorage nor sessionStorage', () => {
    const writes = installStorageSpies();

    useSecurityStore.getState().setVault({ isDemo: false, apiKey: VALID_KEY });
    useSecurityStore.getState().setVault({ isDemo: true });
    useSecurityStore.getState().clearVault();

    expect(writes).toEqual([]);
  });

  it('the spies would catch a write, so the assertion above means something', () => {
    // Guards the guard: if the stubs stopped recording, the test above would
    // pass vacuously forever.
    const writes = installStorageSpies();
    globalThis.localStorage.setItem('apiKey', VALID_KEY);
    expect(writes).toEqual([['localStorage', 'apiKey', VALID_KEY]]);
  });
});
