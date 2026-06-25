import { forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StageAura from './StageAura';

// Shared color configs referenced by stage index
export const STAGE_COLORS = [
  { ring: 'ring-sky-400',     bg: 'bg-sky-50',      border: 'border-sky-200',   header: 'text-sky-700',   dot: 'bg-sky-500',     line: '#0ea5e9' },
  { ring: 'ring-violet-400',  bg: 'bg-violet-50',   border: 'border-violet-200',header: 'text-violet-700',dot: 'bg-violet-500',  line: '#8b5cf6' },
  { ring: 'ring-amber-400',   bg: 'bg-amber-50',    border: 'border-amber-200', header: 'text-amber-700', dot: 'bg-amber-500',   line: '#f59e0b' },
  { ring: 'ring-purple-400',  bg: 'bg-purple-50',   border: 'border-purple-200',header: 'text-purple-700',dot: 'bg-purple-500',  line: '#a855f7' },
  { ring: 'ring-teal-400',    bg: 'bg-teal-50',     border: 'border-teal-200',  header: 'text-teal-700',  dot: 'bg-teal-500',    line: '#14b8a6' },
  { ring: 'ring-orange-400',  bg: 'bg-orange-50',   border: 'border-orange-200',header: 'text-orange-700',dot: 'bg-orange-500',  line: '#f97316' },
  { ring: 'ring-emerald-400', bg: 'bg-emerald-50',  border: 'border-emerald-200',header:'text-emerald-700',dot:'bg-emerald-500', line: '#10b981' },
];

const StageCard = forwardRef(function StageCard(
  { stageIndex, title, subtitle, icon, active, children, isLast = false },
  ref,
) {
  const c = STAGE_COLORS[stageIndex] ?? STAGE_COLORS[0];

  return (
    <div ref={ref} className="relative">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className={`
          rounded-2xl border-2 transition-all duration-300 overflow-hidden
          ${active
            ? `${c.ring} ring-2 ring-offset-2 ${c.bg} ${c.border} shadow-lg`
            : `border-slate-200 bg-white shadow-sm`
          }
        `}
      >
        {/* Header */}
        <div className={`flex items-center gap-3 px-5 py-4 border-b ${active ? c.border : 'border-slate-100'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${active ? c.dot : 'bg-slate-300'}`}>
            {stageIndex + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className={`font-semibold text-sm ${active ? c.header : 'text-slate-500'}`}>
              {icon} {title}
            </div>
            <div className="text-xs text-slate-400 truncate">{subtitle}</div>
          </div>
          {active && (
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${c.bg} ${c.header} border ${c.border}`}>
              active
            </span>
          )}
        </div>

        {/* Content */}
        <div className="p-5">{children}</div>
      </motion.div>

      {/* Theatrical aura — floats around the card when active */}
      <AnimatePresence>
        {active && <StageAura key={`aura-${stageIndex}`} stageIndex={stageIndex} />}
      </AnimatePresence>

      {/* Connector arrow to next stage */}
      {!isLast && (
        <div className="flex justify-center my-1">
          <svg height="36" width="20" className="overflow-visible">
            <line x1="10" y1="0" x2="10" y2="28"
              stroke={active ? c.line : '#cbd5e1'}
              strokeWidth="2"
              strokeDasharray="4 3"
            />
            <polygon
              points="10,36 5,26 15,26"
              fill={active ? c.line : '#cbd5e1'}
            />
          </svg>
        </div>
      )}
    </div>
  );
});

export default StageCard;
