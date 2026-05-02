// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from './use-theme';

describe('useTheme', () => {
    let matchMediaListeners: Array<(event: MediaQueryListEvent) => void> = [];
    let store: Record<string, string> = {};

    beforeEach(() => {
        store = {};
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => store[key] ?? null,
            setItem: (key: string, val: string) => { store[key] = val; },
            removeItem: (key: string) => { delete store[key]; },
            clear: () => { Object.keys(store).forEach(k => delete store[k]); },
        });

        document.documentElement.classList.remove('dark');

        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation((query: string) => ({
                matches: query === '(prefers-color-scheme: dark)',
                media: query,
                addEventListener: vi.fn((_: string, cb: (e: MediaQueryListEvent) => void) => {
                    matchMediaListeners.push(cb);
                }),
                removeEventListener: vi.fn((_: string, cb: (e: MediaQueryListEvent) => void) => {
                    matchMediaListeners = matchMediaListeners.filter(l => l !== cb);
                }),
            })),
        });
    });

    afterEach(() => {
        matchMediaListeners = [];
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('defaults to system theme', () => {
        const { result } = renderHook(() => useTheme());
        expect(result.current.theme).toBe('system');
    });

    it('toggles between light and dark', () => {
        const { result } = renderHook(() => useTheme());
        expect(result.current.effectiveTheme).toBe('dark'); // matchMedia mocks to dark

        act(() => result.current.toggleTheme());
        expect(result.current.theme).toBe('light');
        expect(result.current.effectiveTheme).toBe('light');
        expect(document.documentElement.classList.contains('dark')).toBe(false);

        act(() => result.current.toggleTheme());
        expect(result.current.theme).toBe('dark');
        expect(result.current.effectiveTheme).toBe('dark');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('persists to localStorage', () => {
        const { result } = renderHook(() => useTheme());
        act(() => result.current.setTheme('light'));
        expect(localStorage.getItem('the-bench-theme')).toBe('light');
    });

    it('reads from localStorage on mount', () => {
        localStorage.setItem('the-bench-theme', 'dark');
        const { result } = renderHook(() => useTheme());
        expect(result.current.theme).toBe('dark');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
});
