import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'the-bench-panels';

export interface PanelState {
  leftOpen: boolean;
  rightOpen: boolean;
  hasSeenTeaser: boolean;
}

function getInitialState(): PanelState {
  if (typeof window === 'undefined') {
    return { leftOpen: false, rightOpen: false, hasSeenTeaser: false };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PanelState>;
      return {
        leftOpen: parsed.leftOpen ?? false,
        rightOpen: parsed.rightOpen ?? false,
        hasSeenTeaser: parsed.hasSeenTeaser ?? false,
      };
    }
  } catch { /* ignore */ }
  return { leftOpen: false, rightOpen: false, hasSeenTeaser: false };
}

export function usePanels() {
  const [state, setState] = useState<PanelState>(getInitialState);
  const [isTeasing, setIsTeasing] = useState(!state.hasSeenTeaser);

  // Teaser animation: on first mount, briefly expand both panels to show content exists
  useEffect(() => {
    if (!state.hasSeenTeaser) {
      const openTimer = setTimeout(() => {
        setState(prev => ({ ...prev, leftOpen: true, rightOpen: true }));

        const closeTimer = setTimeout(() => {
          setState(prev => {
            const next = { ...prev, leftOpen: false, rightOpen: false, hasSeenTeaser: true };
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            } catch { /* ignore */ }
            return next;
          });
          setIsTeasing(false);
        }, 1800);

        return () => clearTimeout(closeTimer);
      }, 600);

      return () => clearTimeout(openTimer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleLeft = useCallback(() => {
    setState(prev => {
      const next = { ...prev, leftOpen: !prev.leftOpen };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  const toggleRight = useCallback(() => {
    setState(prev => {
      const next = { ...prev, rightOpen: !prev.rightOpen };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  const closeAll = useCallback(() => {
    setState(prev => {
      const next = { ...prev, leftOpen: false, rightOpen: false };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  return {
    leftOpen: state.leftOpen,
    rightOpen: state.rightOpen,
    isTeasing,
    toggleLeft,
    toggleRight,
    closeAll,
  };
}
