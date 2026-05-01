import React from 'react';

export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = React.useState(false);
    React.useEffect(() => {
        const m = window.matchMedia(query);
        setMatches(m.matches);
        const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
        m.addEventListener('change', listener);
        return () => m.removeEventListener('change', listener);
    }, [query]);
    return matches;
}