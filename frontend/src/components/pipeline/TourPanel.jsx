import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database, Scissors, Hash, Cpu, GitMerge, AlignLeft, Sparkles,
  ChevronLeft, ChevronRight, Play, Pause, CheckCircle2, Circle,
} from 'lucide-react';
import { STAGE_COLORS } from './StageCard';

const STAGES = [
  { icon: <Database size={14} />,    label: 'Raw Data',      desc: 'OpenAlex 原始 JSON 資料結構' },
  { icon: <Scissors size={14} />,    label: 'Text Cleaning', desc: '文字清洗與 token 化' },
  { icon: <Hash size={14} />,        label: 'BM25 Index',    desc: '稀疏關鍵字搜尋評分' },
  { icon: <Cpu size={14} />,         label: 'Vector Embed',  desc: '384-dim 語意向量化' },
  { icon: <GitMerge size={14} />,    label: 'Hybrid RRF',    desc: 'BM25 + 向量互補融合' },
  { icon: <AlignLeft size={14} />,   label: 'RAG Context',   desc: 'Prompt 上下文組裝' },
  { icon: <Sparkles size={14} />,    label: 'Answer Gen',    desc: '引用式回答生成' },
];

export default function TourPanel({ activeStage, setActiveStage, traceData, autoPlay, setAutoPlay, isStreaming = false }) {
  const total = STAGES.length;

  // Auto-advance (only when not streaming)
  useEffect(() => {
    if (!autoPlay || !traceData || isStreaming) return;
    const id = setInterval(() => {
      setActiveStage((s) => (s + 1) % total);
    }, 3500);
    return () => clearInterval(id);
  }, [autoPlay, traceData, isStreaming, total, setActiveStage]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="hidden lg:flex fixed right-4 top-1/2 -translate-y-1/2 z-40
                 w-64 bg-white/90 backdrop-blur-md border border-slate-200
                 rounded-2xl shadow-2xl overflow-hidden flex-col"
      style={{ maxHeight: 'calc(100vh - 4rem)' }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Pipeline Tour
          </span>
          {isStreaming ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-red-500">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </span>
          ) : (
            <span className="text-xs text-slate-400 font-mono">{activeStage + 1}/{total}</span>
          )}
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-blue-500 rounded-full"
            animate={{ width: `${((activeStage + 1) / total) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      {/* Current stage info */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeStage}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="px-4 py-3 border-b border-slate-100"
        >
          <div className={`flex items-center gap-1.5 text-sm font-semibold mb-1 ${STAGE_COLORS[activeStage]?.header ?? 'text-slate-700'}`}>
            {STAGES[activeStage].icon}
            <span>Stage {activeStage + 1}: {STAGES[activeStage].label}</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">{STAGES[activeStage].desc}</p>
          {traceData && (
            <LatencyBadge stage={activeStage} latencies={traceData.latencies_ms} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Stage list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        {STAGES.map((s, i) => {
          const status = i < activeStage ? 'done' : i === activeStage ? 'active' : 'pending';
          const c = STAGE_COLORS[i];
          return (
            <button
              key={i}
              onClick={() => setActiveStage(i)}
              disabled={!traceData}
              className={`
                w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all text-left
                ${status === 'active'  ? `${c.bg} ${c.header} font-semibold` : ''}
                ${status === 'done'    ? 'text-slate-500 hover:bg-slate-50'   : ''}
                ${status === 'pending' ? 'text-slate-400 hover:bg-slate-50 disabled:cursor-default' : ''}
              `}
            >
              {status === 'done' ? (
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
              ) : status === 'active' ? (
                <div className={`w-3.5 h-3.5 rounded-full ${c.dot} shrink-0`} />
              ) : (
                <Circle size={14} className="text-slate-300 shrink-0" />
              )}
              <span className="truncate">{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <div className="px-3 py-3 border-t border-slate-100 bg-slate-50/80 flex items-center gap-2">
        <button
          onClick={() => setActiveStage((s) => Math.max(0, s - 1))}
          disabled={activeStage === 0}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg
                     text-xs font-medium bg-white border border-slate-200 text-slate-600
                     hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={13} /> Prev
        </button>
        {isStreaming ? (
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 border border-red-200">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          </div>
        ) : (
          <button
            onClick={() => setAutoPlay((a) => !a)}
            disabled={!traceData}
            className={`
              flex items-center justify-center w-8 h-8 rounded-lg text-xs border transition-colors
              ${autoPlay
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }
              disabled:opacity-40 disabled:cursor-not-allowed
            `}
            title={autoPlay ? 'Pause auto-play' : 'Start auto-play'}
          >
            {autoPlay ? <Pause size={12} /> : <Play size={12} />}
          </button>
        )}
        <button
          onClick={() => setActiveStage((s) => Math.min(total - 1, s + 1))}
          disabled={activeStage === total - 1}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg
                     text-xs font-medium bg-white border border-slate-200 text-slate-600
                     hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next <ChevronRight size={13} />
        </button>
      </div>
    </motion.div>
  );
}

function LatencyBadge({ stage, latencies }) {
  const keys = ['bm25', 'vector', 'hybrid', 'context', 'answer'];
  const key = keys[stage - 2]; // stages 2-6 map to latency keys
  if (!key || !latencies[key]) return null;
  return (
    <div className="mt-1.5 text-xs text-slate-400">
      ⏱ {latencies[key].toFixed(1)} ms
    </div>
  );
}
