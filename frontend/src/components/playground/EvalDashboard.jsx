import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from 'recharts';
import { Activity, Gauge, GitMerge, SearchCheck, Star } from 'lucide-react';
import { api } from '../../api/client';
import { useT } from '../../i18n/LanguageContext.jsx';

const MODE_COLORS = { bm25: '#f59e0b', vector: '#a855f7', hybrid: '#14b8a6', fts: '#3b82f6' };

function StatCard({ icon: Icon, label, value, sub, color = 'text-slate-600' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon size={14} className={color} />}
        <div className="text-lg font-bold text-slate-800">{value}</div>
      </div>
      <div className="text-xs text-slate-500">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

function modeRows(modes = {}) {
  return Object.entries(modes).map(([mode, m]) => ({
    mode: mode.toUpperCase(),
    rawMode: mode,
    p50: +m.latency_p50_ms.toFixed(1),
    p99: +m.latency_p99_ms.toFixed(1),
    mean: +m.latency_mean_ms.toFixed(1),
    coverage: Math.round((m.coverage_at_10 ?? 0) * 100),
    grounding: Math.round((m.grounding_ready_rate ?? 0) * 100),
    tokenMatch: Math.round((m.token_match_rate ?? 0) * 100),
    citations: +(m.avg_citations ?? 0).toFixed(1),
    hits: +(m.avg_result_count ?? 0).toFixed(1),
  }));
}

function Recommendation({ rows, t }) {
  if (!rows.length) return null;
  const fastest = [...rows].sort((a, b) => a.mean - b.mean)[0];
  const broadest = [...rows].sort((a, b) => b.coverage - a.coverage)[0];
  const hybrid = rows.find((r) => r.rawMode === 'hybrid');
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
      <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">{t('pages.playground.eval.recommendation')}</p>
      <ul className="space-y-1.5 text-xs text-emerald-800 leading-5">
        <li>{t('pages.playground.eval.fastest').replace('{mode}', fastest.mode).replace('{ms}', fastest.mean)}</li>
        <li>{t('pages.playground.eval.broadest').replace('{mode}', broadest.mode).replace('{pct}', broadest.coverage)}</li>
        {hybrid && <li>{t('pages.playground.eval.hybridDefault')}</li>}
      </ul>
    </div>
  );
}

export default function EvalDashboard({ stats, onEvaluate }) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function runEval() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.playgroundEvaluate();
      setResult(data);
      onEvaluate?.(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const rows = modeRows(result?.modes ?? {});
  const radarData = rows.map((r) => ({
    mode: r.mode,
    coverage: r.coverage,
    grounding: r.grounding,
    tokenMatch: r.tokenMatch,
  }));

  return (
    <div data-tour="playground-evaluate" className="space-y-5">
      {stats && (
        <div className="grid grid-cols-2 gap-2">
          <StatCard icon={Activity} label={t('pages.playground.eval.corpus')} value={stats.corpus_total?.toLocaleString()} />
          <StatCard icon={Star} label={t('pages.playground.eval.uploaded')} value={stats.user_uploaded?.toLocaleString()} color="text-amber-600" />
          <StatCard icon={SearchCheck} label={t('pages.playground.eval.bm25Vocab')} value={stats.bm25_vocab_size?.toLocaleString()} sub={`${stats.bm25_doc_count} docs indexed`} color="text-emerald-600" />
          <StatCard icon={Gauge} label={t('pages.playground.eval.vectorCount')} value={stats.vector_count?.toLocaleString()} sub={stats.vector_count === 0 ? t('pages.playground.eval.noEmbeddings') : t('pages.playground.eval.ready')} color="text-purple-600" />
        </div>
      )}

      <button
        onClick={runEval}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            {t('pages.playground.eval.running')}
          </>
        ) : t('pages.playground.eval.run')}
      </button>

      {error && <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{error}</div>}

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <StatCard label={t('pages.playground.eval.corpusPapers')} value={result.corpus_total?.toLocaleString()} />
              <StatCard label={t('pages.playground.eval.testQueries')} value={result.queries_run} />
              <StatCard label={t('pages.playground.eval.evalModes')} value={Object.keys(result.modes).length} />
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{t('pages.playground.eval.latencyChart')}</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={rows} barGap={4} barCategoryGap="28%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="mode" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit=" ms" width={55} />
                  <Tooltip formatter={(v) => `${v} ms`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="p50" name="P50" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="p99" name="P99" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="mean" name="Mean" fill="#a855f7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{t('pages.playground.eval.tradeoffChart')}</p>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="mode" tick={{ fontSize: 11 }} />
                    <Radar name={t('pages.playground.eval.coverage')} dataKey="coverage" stroke="#14b8a6" fill="#14b8a6" fillOpacity={0.22} />
                    <Radar name={t('pages.playground.eval.grounding')} dataKey="grounding" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.18} />
                    <Radar name={t('pages.playground.eval.tokenMatch')} dataKey="tokenMatch" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.14} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <GitMerge size={13} /> {t('pages.playground.eval.overlapChart')}
                </p>
                <div className="space-y-2.5">
                  {(result.mode_overlap ?? []).map((o) => {
                    const total = Math.max(1, o.bm25_only + o.vector_only + o.both);
                    return (
                      <div key={o.query}>
                        <p className="text-xs text-slate-500 truncate mb-1">{o.query}</p>
                        <div className="flex h-6 rounded-lg overflow-hidden bg-slate-100 text-[10px] font-semibold text-white">
                          <div style={{ width: `${(o.bm25_only / total) * 100}%` }} className="bg-amber-500 flex items-center justify-center">BM25</div>
                          <div style={{ width: `${(o.both / total) * 100}%` }} className="bg-teal-600 flex items-center justify-center">Both</div>
                          <div style={{ width: `${(o.vector_only / total) * 100}%` }} className="bg-purple-600 flex items-center justify-center">Vector</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['mode', 'mean', 'coverage', 'grounding', 'citations', 'hits'].map((k) => (
                      <th key={k} className="py-2 px-3 text-right first:text-left text-xs font-semibold text-slate-500 uppercase">
                        {t(`pages.playground.eval.table.${k}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.rawMode} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-left">
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: MODE_COLORS[r.rawMode] ?? '#94a3b8' }} />
                          {r.mode}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-sm text-slate-600">{r.mean}</td>
                      <td className="py-2.5 px-3 text-right text-sm text-slate-600">{r.coverage}%</td>
                      <td className="py-2.5 px-3 text-right text-sm text-slate-600">{r.grounding}%</td>
                      <td className="py-2.5 px-3 text-right text-sm text-slate-600">{r.citations}</td>
                      <td className="py-2.5 px-3 text-right text-sm text-slate-600">{r.hits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Recommendation rows={rows} t={t} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
