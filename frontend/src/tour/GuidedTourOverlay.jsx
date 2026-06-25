import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react';
import { useTour } from './TourContext.jsx';
import { useT } from '../i18n/LanguageContext.jsx';
import { useWordReveal } from '../hooks/useWordReveal.js';
import ThemedParticles from './ThemedParticles.jsx';

const CARD_W = 340;
const PAD = 8; // spotlight padding around the anchor

export default function GuidedTourOverlay() {
  const { active, stepIndex, steps, next, prev, stop } = useTour();
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const [rect, setRect] = useState(null);
  const elRef = useRef(null);

  const step = active ? steps[stepIndex] : null;
  const hasAnchor = !!step?.anchor;

  // Word-by-word reveal of the body text (hook must run unconditionally).
  const bodyText = step ? t(step.bodyKey) : '';
  const revealedBody = useWordReveal(bodyText, 22);

  // 1) Navigate to the step's route (steps with route=null stay on the current page).
  useEffect(() => {
    if (!active || !step) return;
    if (step.route && location.pathname !== step.route) navigate(step.route);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepIndex]);

  // 2) Wait for the anchor element to appear, then measure it.
  useEffect(() => {
    if (!active || !step) { setRect(null); elRef.current = null; return; }
    if (!step.anchor) { setRect(null); elRef.current = null; return; } // welcome / centered step
    let raf, tries = 0, cancelled = false;
    setRect(null);
    const measure = () => { if (!cancelled && elRef.current) setRect(elRef.current.getBoundingClientRect()); };
    const find = () => {
      if (cancelled) return;
      const el = document.querySelector(step.anchor);
      if (el) {
        elRef.current = el;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(measure, 360);
        return;
      }
      tries += 1;
      if (tries < 150) raf = requestAnimationFrame(find); // ~2.5s budget
    };
    find();
    return () => { cancelled = true; cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepIndex, location.pathname]);

  // 3) Keep the rect in sync while scrolling/resizing.
  useEffect(() => {
    if (!active) return;
    const update = () => { if (elRef.current) setRect(elRef.current.getBoundingClientRect()); };
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [active]);

  if (!active || !step) return null;

  const total = steps.length;
  const isLast = stepIndex === total - 1;

  // Card position
  let cardStyle = { left: '50%', top: '50%', transform: 'translate(-50%,-50%)' };
  if (rect) {
    const left = Math.min(Math.max(rect.left, 16), window.innerWidth - CARD_W - 16);
    if (step.placement === 'top') {
      cardStyle = { left, top: rect.top - 14, transform: 'translateY(-100%)' };
    } else {
      cardStyle = { left, top: rect.bottom + 14, transform: 'none' };
    }
  }

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Spotlight: a hole punched around the anchor; dims everything else. */}
      {rect ? (
        <motion.div
          className="fixed rounded-xl"
          initial={false}
          animate={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
          }}
          transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          style={{ boxShadow: '0 0 0 9999px rgba(15,23,42,0.62), 0 0 0 2px rgba(96,165,250,0.9)' }}
        />
      ) : (
        <div className="fixed inset-0" style={{ background: 'rgba(15,23,42,0.66)' }} />
      )}

      {/* Themed particle "performance" around the anchor (or screen center) */}
      <ThemedParticles rect={rect} theme={step.theme} />

      {/* Teaching card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{ duration: 0.25 }}
          className={`fixed z-[102] w-[340px] rounded-2xl border bg-white/95 dark:bg-slate-800/95
                      backdrop-blur-md shadow-2xl p-4 ${hasAnchor ? 'border-blue-200 dark:border-blue-800' : 'border-violet-200 dark:border-violet-800'}`}
          style={cardStyle}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shrink-0">
              <Sparkles size={14} className="text-white" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex-1">{t(step.titleKey)}</h3>
            <button onClick={stop} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
              <X size={15} />
            </button>
          </div>

          {/* Body — word-by-word reveal with a soft caret while typing */}
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 mb-3 min-h-[3rem]">
            {revealedBody}
            {revealedBody.length < bodyText.length && (
              <span className="inline-block w-1 h-3 bg-blue-500 align-middle ml-0.5 animate-pulse" />
            )}
          </p>

          {/* Progress dots */}
          <div className="flex items-center gap-1 mb-3 flex-wrap">
            {steps.map((s, i) => (
              <span
                key={s.id}
                className={`h-1.5 rounded-full transition-all ${
                  i === stepIndex ? 'w-5 bg-blue-600' : 'w-1.5 bg-slate-300 dark:bg-slate-600'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {t('tour.stepOf').replace('{n}', stepIndex + 1).replace('{total}', total)}
            </span>
            <div className="flex items-center gap-1.5">
              <button onClick={stop} className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                {t('tour.skip')}
              </button>
              {stepIndex > 0 && (
                <button
                  onClick={prev}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <ChevronLeft size={12} /> {t('tour.prev')}
                </button>
              )}
              <button
                onClick={next}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                {isLast ? t('tour.done') : t('tour.next')}
                {!isLast && <ChevronRight size={12} />}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
