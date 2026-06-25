import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Database, Hash, Cpu, Search, MessageSquare, BarChart2,
  Lock, Check, Loader2, SkipForward,
} from 'lucide-react';

const STEP_META = [
  { key: 'source',     label: '資料來源',      icon: Upload,        color: 'text-sky-500'     },
  { key: 'ingest',     label: '寫入 DuckDB',   icon: Database,      color: 'text-violet-500'  },
  { key: 'bm25',       label: 'BM25 索引',     icon: Hash,          color: 'text-amber-500'   },
  { key: 'embeddings', label: '向量嵌入',       icon: Cpu,           color: 'text-purple-500'  },
  { key: 'search',     label: '搜尋測試',       icon: Search,        color: 'text-teal-500'    },
  { key: 'rag',        label: 'RAG 回答',       icon: MessageSquare, color: 'text-orange-500'  },
  { key: 'evaluate',   label: '評估儀表板',     icon: BarChart2,     color: 'text-emerald-500' },
];

function StatusIcon({ status, color }) {
  if (status === 'done')    return <Check size={12} className="text-emerald-500" />;
  if (status === 'running') return <Loader2 size={12} className={`${color} animate-spin`} />;
  if (status === 'skipped') return <SkipForward size={12} className="text-slate-400" />;
  if (status === 'locked')  return <Lock size={12} className="text-slate-600" />;
  return null;
}

export default function StepPanel({ stepStatus, currentStep, onJump }) {
  const progress = STEP_META.filter((s) => stepStatus[s.key] === 'done').length;

  return (
    <div
      className="hidden lg:block fixed right-4 z-50 w-56"
      style={{ top: '50%', transform: 'translateY(-50%)' }}
    >
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="rounded-2xl border border-slate-200 bg-white/95 shadow-xl shadow-slate-200/50 backdrop-blur-sm overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <p className="text-xs font-semibold text-slate-700">Playground 步驟</p>
          <div className="mt-1.5 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(progress / STEP_META.length) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">{progress} / {STEP_META.length} 完成</p>
        </div>

        {/* Step list */}
        <div className="py-2">
          {STEP_META.map(({ key, label, icon: Icon, color }, idx) => {
            const status = stepStatus[key] ?? 'locked';
            const isActive = key === currentStep;
            const clickable = status !== 'locked';

            return (
              <button
                key={key}
                disabled={!clickable}
                onClick={() => clickable && onJump?.(key)}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors
                  ${isActive ? 'bg-blue-50' : ''}
                  ${clickable ? 'hover:bg-slate-50 cursor-pointer' : 'cursor-default opacity-50'}
                `}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0
                  ${status === 'done' ? 'bg-emerald-100' : status === 'running' ? 'bg-blue-100' : 'bg-slate-100'}`}
                >
                  <Icon size={12} className={
                    status === 'done' ? 'text-emerald-600' :
                    status === 'running' ? 'text-blue-600' :
                    status === 'active' ? color :
                    'text-slate-400'
                  } />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium truncate ${isActive ? 'text-blue-700' : status === 'locked' ? 'text-slate-400' : 'text-slate-700'}`}>
                    {label}
                  </p>
                  <p className="text-xs text-slate-400">
                    {status === 'done' ? '✓ 完成' :
                     status === 'running' ? '執行中…' :
                     status === 'skipped' ? '已跳過' :
                     status === 'active' ? '▸ 當前' : '🔒'}
                  </p>
                </div>
                <StatusIcon status={status} color={color} />
              </button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
