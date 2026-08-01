import { useMemo } from 'react';
import { useCourtroomScript } from './useCourtroomScript';
import { deriveRevealState, type RevealState } from '../lib/reveal';

// What the judge has lawfully seen, derived from the revealed transcript
// prefix. Resets naturally with the beat cursor on case start/reset — there
// is nothing to clear because nothing is stored.
export function useRevealState(): RevealState {
  const { visibleEntries } = useCourtroomScript();
  return useMemo(() => deriveRevealState(visibleEntries), [visibleEntries]);
}
