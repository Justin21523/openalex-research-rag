import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SkipForward, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

function AnimatedCounter({ target, duration = 1000, suffix = '' }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!target) return;
    let frame = 0;
    const steps = Math.ceil(duration / 16);
    const step = target / steps;
    const id = setInterval(() => {
      frame++;
      setVal(Math.min(Math.round(step * frame), target));
      if (frame >= steps) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [target, duration]);
  return <span>{val.toLocaleString()}{suffix}</span>;
}

export default function BuildStep({
  label,
  description,
  buttonLabel = 'Build',
  skipLabel,
  color = 'blue',
  onRun,
  onSkip,
  result,
  status,        // 'active' | 'running' | 'done' | 'skipped' | 'locked'
  renderResult,  // optional custom result renderer
  progressValue, // 0-100 for streaming progress
  progressTotal,
}) {
  const [error, setError] = useState(null);

  async function handleRun() {
    setError(null);
    try {
      await onRun?.();
    } catch (err) {
      setError(err.message);
    }
  }

  const colorMap = {
    blue:   { btn: 'bg-blue-600 hover:bg-blue-700',   ring: 'border-blue-200 bg-blue-50', badge: 'bg-blue-100 text-blue-700' },
    amber:  { btn: 'bg-amber-500 hover:bg-amber-600',  ring: 'border-amber-200 bg-amber-50', badge: 'bg-amber-100 text-amber-700' },
    purple: { btn: 'bg-purple-600 hover:bg-purple-700',ring: 'border-purple-200 bg-purple-50', badge: 'bg-purple-100 text-purple-700' },
    teal:   { btn: 'bg-teal-600 hover:bg-teal-700',   ring: 'border-teal-200 bg-teal-50', badge: 'bg-teal-100 text-teal-700' },
  };
  const c = colorMap[color] ?? colorMap.blue;

  return (
    <div className={`rounded-xl border-2 p-5 transition-all duration-300 ${
      status === 'active' ? c.ring : 'border-slate-200 bg-white'
    } ${status === 'locked' ? 'opacity-50' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-700">{label}</p>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
        {status === 'done' && <CheckCircle2 size={18} className="text-emerald-500 shrink-0 ml-2" />}
      </div>

      {/* Streaming progress */}
      {status === 'running' && progressValue != null && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>進行中…</span>
            <span>{progressValue} / {progressTotal ?? '?'}</span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${c.btn.split(' ')[0]}`}
              animate={{ width: `${progressTotal ? (progressValue / progressTotal) * 100 : 50}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      {/* Spinner for non-progress running */}
      {status === 'running' && progressValue == null && (
        <div className="flex items-center gap-2 mb-3 text-xs text-slate-500">
          <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
          執行中…
        </div>
      )}

      {/* Result display */}
      <AnimatePresence>
        {(status === 'done' || status === 'skipped') && result && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 overflow-hidden"
          >
            {renderResult ? renderResult(result) : (
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(result).filter(([k]) => !['index_type'].includes(k)).map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-2">
                    <div className="text-xs text-slate-400 capitalize">{k.replace(/_/g, ' ')}</div>
                    <div className="text-sm font-semibold text-slate-700 font-mono">
                      {typeof v === 'number' ? v.toLocaleString() : String(v)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-1.5 mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-2">
          <AlertCircle size={12} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Actions */}
      {status !== 'locked' && (
        <div className="flex gap-2">
          <button
            onClick={handleRun}
            disabled={status === 'running'}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-white text-xs font-semibold
              transition-colors ${c.btn} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {status === 'running' ? (
              <>
                <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                執行中…
              </>
            ) : (
              <>
                {status === 'done' ? <RefreshCw size={12} /> : null}
                {status === 'done' ? '重新執行' : buttonLabel}
              </>
            )}
          </button>
          {skipLabel && status === 'active' && (
            <button
              onClick={onSkip}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-500
                         text-xs hover:bg-slate-50 transition-colors"
            >
              <SkipForward size={12} />
              {skipLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
