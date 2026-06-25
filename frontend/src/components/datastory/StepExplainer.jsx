import { motion } from 'framer-motion';
import { HelpCircle, Zap, Star } from 'lucide-react';
import { useT } from '../../i18n/LanguageContext.jsx';

const STAGE_KEYS = ['raw', 'clean', 'bm25', 'vector', 'hybrid', 'context', 'answer'];

// Headline metric chips per stage, derived from the live traceData.
function metricsFor(stageIndex, td) {
  if (!td) return [];
  switch (stageIndex) {
    case 0: {
      const w = td.sample_work;
      return w ? [
        { label: 'work_id', value: w.work_id },
        { label: 'refs', value: w.referenced_works_count ?? 0 },
        { label: 'year', value: w.publication_year ?? '—' },
      ] : [];
    }
    case 1: {
      const c = td.text_cleaning;
      return c ? [{ label: 'tokens', value: (c.query_tokens ?? []).length }] : [];
    }
    case 2: {
      const b = td.bm25;
      return b ? [
        { label: 'corpus', value: Number(b.corpus_size ?? 0).toLocaleString() },
        { label: 'top-K', value: (b.results ?? []).length },
      ] : [];
    }
    case 3: {
      const v = td.vector;
      return v ? [
        { label: 'dim', value: v.embedding_dim ?? 384 },
        { label: 'top-K', value: (v.results ?? []).length },
      ] : [];
    }
    case 4: {
      const h = td.hybrid;
      return h ? [
        { label: 'RRF k', value: h.rrf_k ?? 60 },
        { label: 'fused', value: (h.results ?? []).length },
      ] : [];
    }
    case 5: {
      const r = td.rag_context;
      return r ? [
        { label: '~tokens', value: Number(r.estimated_tokens ?? 0).toLocaleString() },
        { label: 'papers', value: (r.works_used ?? []).length },
      ] : [];
    }
    case 6: {
      const a = td.answer;
      return a ? [
        { label: 'mode', value: a.mode ?? '—' },
        { label: 'citations', value: (a.citations ?? []).length },
        { label: 'ms', value: Math.round(a.latency_ms ?? 0) },
      ] : [];
    }
    default: return [];
  }
}

export default function StepExplainer({ stageIndex, traceData }) {
  const t = useT();
  const key = STAGE_KEYS[stageIndex] ?? 'raw';
  const base = `pages.dataStory.explain.${key}`;
  const metrics = metricsFor(stageIndex, traceData);

  const rows = [
    { icon: HelpCircle, color: 'text-blue-500',    label: t('pages.dataStory.whatLabel'),   text: t(`${base}.what`) },
    { icon: Zap,        color: 'text-amber-500',   label: t('pages.dataStory.effectLabel'), text: t(`${base}.effect`) },
    { icon: Star,       color: 'text-emerald-500', label: t('pages.dataStory.whyLabel'),    text: t(`${base}.why`) },
  ];

  return (
    <motion.div
      key={key}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5"
    >
      {/* Metric chips */}
      {metrics.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {metrics.map((m) => (
            <div key={m.label} className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700/60 text-xs">
              <span className="text-slate-400">{m.label}</span>{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">{m.value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {rows.map(({ icon: Icon, color, label, text }) => (
          <div key={label} className="flex gap-2.5">
            <Icon size={16} className={`${color} shrink-0 mt-0.5`} />
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
