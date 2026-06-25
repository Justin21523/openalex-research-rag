import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Clock, Layers, TrendingUp, BarChart2, RefreshCw, Loader2, Search } from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { api } from '../api/client.js';
import { useT } from '../i18n/LanguageContext.jsx';

const MODE_COLORS = {
  hybrid: '#3b82f6',
  bm25:   '#10b981',
  vector: '#8b5cf6',
  fts:    '#f59e0b',
};

const LATENCY_COLORS = {
  '<200ms':    '#10b981',
  '200-500ms': '#3b82f6',
  '500ms-1s':  '#f59e0b',
  '>1s':       '#ef4444',
};

export default function AnalyticsDashboard() {
  const t = useT();
  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const navigate = useNavigate();

  // Load summary and recent independently — a failure in one must not blank the
  // whole page (e.g. if the backend was briefly unavailable mid-restart).
  const load = async () => {
    setLoading(true);
    setLoadError(false);
    const [s, r] = await Promise.allSettled([
      api.getAnalyticsSummary(),
      api.getRecentQueries(20),
    ]);
    if (s.status === 'fulfilled') setSummary(s.value);
    if (r.status === 'fulfilled') setRecent(Array.isArray(r.value) ? r.value : []);
    if (s.status === 'rejected' && r.status === 'rejected') {
      setLoadError(true);
      console.error('Analytics load failed', s.reason, r.reason);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const modePieData = summary?.mode_distribution
    ? Object.entries(summary.mode_distribution).map(([k, v]) => ({ name: k, value: v, fill: MODE_COLORS[k] ?? '#94a3b8' }))
    : [];

  const latencyPieData = summary?.latency_distribution
    ? Object.entries(summary.latency_distribution).map(([k, v]) => ({ name: k, value: v, fill: LATENCY_COLORS[k] ?? '#94a3b8' }))
    : [];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Activity size={24} className="text-blue-600 dark:text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('pages.analytics.title', 'Search Analytics')}</h1>
          <p className="text-slate-500 text-sm">{t('pages.analytics.subtitle', 'Query patterns and performance from the search log')}</p>
        </div>
        <button onClick={load} className="ml-auto p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
          <RefreshCw size={15} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-blue-500" />
        </div>
      ) : loadError ? (
        <div className="text-center py-12">
          <p className="text-slate-400 mb-3">{t('pages.analytics.couldNotReach', 'Couldn’t reach the analytics service.')}</p>
          <button onClick={load} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
            {t('pages.analytics.retry', 'Retry')}
          </button>
        </div>
      ) : !summary || (summary.total_queries ?? 0) === 0 ? (
        <p className="text-slate-400 text-center py-12">{t('pages.analytics.noData', 'No analytics data yet. Run some searches first!')}</p>
      ) : (
        <>
          {/* Summary stat cards */}
          <div data-tour="analytics-summary" className="grid grid-cols-3 gap-4 mb-6">
            {[
              { icon: Search, label: t('pages.analytics.totalSearches', 'Total Searches'), value: summary.total_queries.toLocaleString(), color: 'text-blue-600' },
              { icon: Clock,  label: t('pages.analytics.avgLatency', 'Avg Latency'), value: `${summary.avg_latency_ms} ms`, color: 'text-emerald-600' },
              { icon: BarChart2, label: t('pages.analytics.avgResults', 'Avg Results'), value: summary.avg_results_count, color: 'text-purple-600' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={14} className={color} />
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">{label}</span>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Mode distribution */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">{t('pages.analytics.searchModeUsage', 'Search Mode Usage')}</h2>
              {modePieData.length > 0 ? (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={130} height={130}>
                    <PieChart>
                      <Pie data={modePieData} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={55} strokeWidth={0}>
                        {modePieData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                      </Pie>
                      <Tooltip formatter={(v, n) => [v, n]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 text-xs">
                    {modePieData.map((d) => (
                      <div key={d.name} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.fill }} />
                        <span className="text-slate-600 dark:text-slate-400 capitalize">{d.name}</span>
                        <span className="font-bold text-slate-900 dark:text-white ml-auto">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <p className="text-sm text-slate-400">{t('pages.analytics.noChartData', 'No data')}</p>}
            </div>

            {/* Latency distribution */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">{t('pages.analytics.responseTimeDistribution', 'Response Time Distribution')}</h2>
              {latencyPieData.length > 0 ? (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={130} height={130}>
                    <PieChart>
                      <Pie data={latencyPieData} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={55} strokeWidth={0}>
                        {latencyPieData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                      </Pie>
                      <Tooltip formatter={(v, n) => [v, n]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 text-xs">
                    {latencyPieData.map((d) => (
                      <div key={d.name} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.fill }} />
                        <span className="text-slate-600 dark:text-slate-400">{d.name}</span>
                        <span className="font-bold text-slate-900 dark:text-white ml-auto">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <p className="text-sm text-slate-400">{t('pages.analytics.noChartData', 'No data')}</p>}
            </div>
          </div>

          {/* Top queries bar chart */}
          {summary.top_queries.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 mb-6">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">{t('pages.analytics.mostFrequentQueries', 'Most Frequent Queries')}</h2>
              <ResponsiveContainer width="100%" height={Math.max(160, summary.top_queries.length * 26)}>
                <BarChart data={summary.top_queries} layout="vertical" margin={{ left: 0, right: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="text" width={220} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [v, t('pages.analytics.searches', 'searches')]} />
                  <Bar
                    dataKey="count"
                    fill="#3b82f6"
                    radius={[0, 4, 4, 0]}
                    onClick={(d) => { navigate(`/?q=${encodeURIComponent(d.text)}`); }}
                    cursor="pointer"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Recent queries table */}
          {recent.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('pages.analytics.recentSearches', 'Recent Searches')}</h2>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {recent.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors"
                    onClick={() => navigate(`/?q=${encodeURIComponent(r.query_text)}`)}
                  >
                    <Search size={12} className="text-slate-400 shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-300 flex-1 truncate">{r.query_text}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full capitalize shrink-0"
                      style={{ background: `${MODE_COLORS[r.mode]}20`, color: MODE_COLORS[r.mode] ?? '#94a3b8' }}>
                      {r.mode}
                    </span>
                    <span className="text-xs text-slate-400 shrink-0">{r.results_count ?? 0} {t('pages.analytics.results', 'results')}</span>
                    <span className="text-xs text-slate-400 shrink-0">{r.latency_ms?.toFixed(0)} ms</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
