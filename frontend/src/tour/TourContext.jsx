import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { TOUR_STEPS } from './tourSteps.js';

const TourContext = createContext(null);

export function TourProvider({ children }) {
  // Auto-trigger on every fresh page load (the welcome step is anchorless and
  // does not force-navigate, so it just shows a centered greeting card).
  const [active, setActive] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);

  const start = useCallback(() => { setStepIndex(0); setActive(true); }, []);
  const stop = useCallback(() => setActive(false), []);
  const goTo = useCallback((i) => {
    if (i < 0 || i >= TOUR_STEPS.length) return;
    setStepIndex(i);
  }, []);
  const next = useCallback(() => {
    setStepIndex((i) => {
      if (i + 1 >= TOUR_STEPS.length) { setActive(false); return i; }
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
