import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { TOUR_STEPS } from './tourSteps.js';

const TourContext = createContext(null);
const SEEN_KEY = 'openalex-guided-tour-seen';

export function TourProvider({ children }) {
  const [active, setActive] = useState(() => {
    try {
      return localStorage.getItem(SEEN_KEY) !== '1';
    } catch {
      return true;
    }
  });
  const [stepIndex, setStepIndex] = useState(0);

  const start = useCallback(() => { setStepIndex(0); setActive(true); }, []);
  const stop = useCallback(() => {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
    setActive(false);
  }, []);
  const goTo = useCallback((i) => {
    if (i < 0 || i >= TOUR_STEPS.length) return;
    setStepIndex(i);
  }, []);
  const next = useCallback(() => {
    setStepIndex((i) => {
      if (i + 1 >= TOUR_STEPS.length) {
        try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
        setActive(false);
        return i;
      }
      return i + 1;
    });
  }, []);
  const prev = useCallback(() => setStepIndex((i) => Math.max(0, i - 1)), []);

  const value = useMemo(() => ({
    active, stepIndex, steps: TOUR_STEPS,
    start, stop, next, prev, goTo,
  }), [active, stepIndex, start, stop, next, prev, goTo]);

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within TourProvider');
  return ctx;
}
