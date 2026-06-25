import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Flag } from 'lucide-react';
import { useT } from '../../i18n/LanguageContext.jsx';
import Markdown from '../ui/Markdown.jsx';

const LAT_COLORS = ['#f59e0b', '#a855f7', '#14b8a6', '#f97316', '#10b981'];

export default function JourneySummary({ traceData }) {
  const t = useT();
  if (!traceData) return null;

  const lat = traceData.latencies_ms ?? {};
  const latencyData = [
    { name: 'BM25', value: lat.bm25 ?? 0 },
    { name: 'Vector', value: lat.vector ?? 0 },
    { name: 'RRF', value: lat.hybrid ?? 0 },
    { name: 'Context', value: lat.context ?? 0 },
    { name: 'Answer', value: lat.answer ?? 0 },
  ];

  const corpus = traceData.bm25?.corpus_size ?? 0;
  const topk = (traceData.hybrid?.results ?? traceData.bm25?.results ?? []).length;
  const ctx = (traceData.rag_context?.works_used ?? []).length;
  const funnel = [
    { label: t('pages.dataStory.funnelCorpus'),  value: corpus, display: corpus ? Number(corpus).toLocaleString() : '—', pct: 100 },
    { label: t('pages.dataStory.funnelTopk'),    value: topk,   display: topk,  pct: 70 },
    { label: t('pages.dataStory.funnelContext'), value: ctx,    display: ctx,   pct: 45 },
    { label: t('pages.dataStory.funnelAnswer'),  value: 1,      display: 1,     pct: 22 },
  ];

  const answer = traceData.answer?.answer_text ?? '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mt-6 space-y-5"
    >
      <div className="flex items-center gap-2">
        <Flag size={18} className="text-emerald-500" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('pages.dataStory.summaryTitle')}</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Latency breakdown */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">{t('pages.dataStory.latencyTitle')}</h3>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={latencyData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} width={36} />
              <Tooltip formatter={(v) => [`${Number(v).toFixed(1)} ms`, 'latency']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {latencyData.map((_, i) => <Cell key={i} fill={LAT_COLORS[i % LAT_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Candidate funnel */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">{t('pages.dataStory.funnelTitle')}</h3>
          <div className="space-y-2.5">
            {funnel.map((f, i) => (
              <div key={f.label} className="flex items-center gap-3">
                <span className="w-24 text-xs text-slate-500 dark:text-slate-400 shrink-0">{f.label}</span>
                <div className="flex-1 h-6 rounded-lg bg-slate-100 dark:bg-slate-700/50 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${f.pct}%` }}
                    transition={{ duration: 0.6, delay: i * 0.12 }}
                    className="h-full rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 flex items-center justify-end pr-2"
                  >
                    <span className="text-xs font-semibold text-white">{f.display}</span>
                  </motion.div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Final answer */}
      {answer && (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-900 p-5">
          <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-2">{t('pages.dataStory.finalAnswer')}</h3>
          <Markdown text={answer} />
        </div>
      )}
    </motion.div>
  );
}
