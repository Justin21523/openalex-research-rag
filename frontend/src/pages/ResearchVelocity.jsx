import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, TrendingUp, TrendingDown, Loader2, ArrowUpRight } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { api } from '../api/client.js';
import { useT } from '../i18n/LanguageContext.jsx';

const RECENT_YEARS = [2022, 2023, 2024];
const OLDER_YEARS  = [2018, 2019, 2020, 2021];

async function fetchVelocity(concepts) {
  const results = await Promise.all(
    concepts.map(async (c) => {
      try {
        const trends = await api.getTopicTrends({ concept: c.concept_name, year_from: 2015, year_to: 2024 });
        const byYear = Object.fromEntries(trends.map((t) => [t.year, t.count]));
        const recent = RECENT_YEARS.reduce((s, y) => s + (byYear[y] || 0), 0);
        const older  = OLDER_YEARS.reduce((s, y) => s + (byYear[y] || 0), 0);
        const growth = older === 0
          ? (recent > 0 ? 999 : 0)
          : Math.round(((recent - older) / older) * 100);
        return { concept: c.concept_name, work_count: c.work_count, recent, older, growth };
      } catch {
        return null;
      }
    }),
  );
  return results.filter(Boolean);
}

export default function ResearchVelocity() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const tr = useT();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const concepts = await api.getTopConcepts(25);
        // Exclude very generic concepts
        const filtered = concepts.filter(
          (c) => !['Computer science', 'Mathematics', 'Philosophy', 'Biology', 'Physics',
                    'Chemistry', 'Medicine', 'Law', 'Psychology', 'Archaeology', 'Paleontology',
                    'Geography', 'Epistemology'].includes(c.concept_name)
        ).slice(0, 20);
        const velocity = await fetchVelocity(filtered);
        velocity.sort((a, b) => b.growth - a.growth);
        setItems(velocity);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const chartData = items.map((item) => ({
    ...item,
    fill: item.growth > 0 ? '#10b981' : item.growth < 0 ? '#ef4444' : '#94a3b8',
  }));

  const rising  = items.filter((i) => i.growth > 0).slice(0, 8);
  const falling = items.filter((i) => i.growth < 0).slice(-5).reverse();

  return (
    <div className="max-w-5xl mx-auto">
      <div data-tour="velocity" className="flex items-center gap-3 mb-6">
        <Zap size={24} className="text-amber-500" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{tr('pages.velocity.title', 'Research Velocity')}</h1>
          <p className="text-sm text-slate-500">
            {tr('pages.velocity.subtitle', 'Publication growth rate: 2022–2024 vs 2018–2021 (% change)')}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 size={28} className="animate-spin text-blue-500" />
          <p className="text-sm text-slate-500">{tr('pages.velocity.loading', 'Fetching trend data for top concepts… (this may take ~10s)')}</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3 text-emerald-700 dark:text-emerald-400">
                <TrendingUp size={16} />
                <span className="text-sm font-semibold">{tr('pages.velocity.fastestGrowing', 'Fastest Growing')}</span>
              </div>
              <div className="space-y-2">
                {rising.slice(0, 5).map((item) => (
                  <div
                    key={item.concept}
                    className="flex items-center justify-between cursor-pointer hover:opacity-80"
                    onClick={() => navigate(`/topics?concept=${encodeURIComponent(item.concept)}`)}
                  >
                    <span className="text-sm text-slate-700 dark:text-slate-300 truncate flex-1">{item.concept}</span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 ml-2 shrink-0">
                      +{item.growth === 999 ? '∞' : item.growth}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3 text-red-700 dark:text-red-400">
                <TrendingDown size={16} />
                <span className="text-sm font-semibold">{tr('pages.velocity.slowingDown', 'Slowing Down')}</span>
              </div>
              <div className="space-y-2">
                {falling.length > 0 ? falling.map((item) => (
                  <div
                    key={item.concept}
                    className="flex items-center justify-between cursor-pointer hover:opacity-80"
                    onClick={() => navigate(`/topics?concept=${encodeURIComponent(item.concept)}`)}
                  >
                    <span className="text-sm text-slate-700 dark:text-slate-300 truncate flex-1">{item.concept}</span>
                    <span className="text-sm font-bold text-red-600 dark:text-red-400 ml-2 shrink-0">
                      {item.growth}%
                    </span>
                  </div>
                )) : (
                  <p className="text-sm text-slate-400">{tr('pages.velocity.allGrowing', 'All topics growing')}</p>
                )}
              </div>
            </div>
          </div>

          {/* Main bar chart */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 mb-6">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
              {tr('pages.velocity.chartTitle', 'Growth Rate by Concept (%)')}
            </h2>
            <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 30)}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 50 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} unit="%" />
                <YAxis type="category" dataKey="concept" width={180} tick={{ fontSize: 11 }} />
                <ReferenceLine x={0} stroke="#94a3b8" strokeWidth={1.5} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white rounded-lg px-3 py-2 text-xs shadow-xl">
                        <p className="font-semibold mb-1">{d.concept}</p>
                        <p>{tr('pages.velocity.tooltipRecent', 'Recent (2022-24):')} {d.recent.toLocaleString()} {tr('pages.velocity.papers', 'papers')}</p>
                        <p>{tr('pages.velocity.tooltipOlder', 'Older (2018-21):')} {d.older.toLocaleString()} {tr('pages.velocity.papers', 'papers')}</p>
                        <p className={`font-bold mt-1 ${d.growth > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {d.growth > 0 ? '+' : ''}{d.growth === 999 ? '∞' : d.growth}% {tr('pages.velocity.change', 'change')}
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="growth" radius={[0, 4, 4, 0]} onClick={(d) => navigate(`/topics?concept=${encodeURIComponent(d.concept)}`)}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Detail table */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{tr('pages.velocity.fullRankings', 'Full Rankings')}</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{tr('pages.velocity.colConcept', 'Concept')}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">2022-24</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">2018-21</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">{tr('pages.velocity.colGrowth', 'Growth')}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">{tr('pages.velocity.colTrend', 'Trend')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {items.map((item, i) => (
                  <tr
                    key={item.concept}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors"
                    onClick={() => navigate(`/topics?concept=${encodeURIComponent(item.concept)}`)}
                  >
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">{i + 1}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900 dark:text-white flex items-center gap-1">
                        {item.concept}
                        <ArrowUpRight size={12} className="text-slate-400" />
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{item.recent.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400">{item.older.toLocaleString()}</td>
                    <td className={`px-4 py-3 text-right font-bold ${
                      item.growth > 0 ? 'text-emerald-600 dark:text-emerald-400' : item.growth < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'
                    }`}>
                      {item.growth > 0 ? '+' : ''}{item.growth === 999 ? '∞' : item.growth}%
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.growth > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                          <TrendingUp size={10} /> {tr('pages.velocity.rising', 'Rising')}
                        </span>
                      ) : item.growth < 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                          <TrendingDown size={10} /> {tr('pages.velocity.declining', 'Declining')}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">{tr('pages.velocity.stable', 'Stable')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
