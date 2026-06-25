import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart2, TrendingUp, BookOpen, Loader2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { api } from '../api/client.js';
import { useT } from '../i18n/LanguageContext.jsx';

const SORT_OPTIONS = [
  { value: 'paper_count', label: 'Most Papers' },
  { value: 'avg_citations', label: 'Highest Avg Citations' },
];

const BLUE_PALETTE = [
  '#3b82f6','#2563eb','#1d4ed8','#1e40af','#1e3a8a',
  '#60a5fa','#93c5fd','#bfdbfe','#dbeafe','#eff6ff',
];

export default function JournalAnalysis() {
  const tr = useT();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('paper_count');
  const [limit, setLimit] = useState(25);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    api.getJournalStats(limit, sortBy)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [sortBy, limit]);

  const chartData = data.map((d, i) => ({
    ...d,
    shortName: d.journal.length > 30 ? d.journal.slice(0, 28) + '…' : d.journal,
    fill: BLUE_PALETTE[i % BLUE_PALETTE.length],
  }));

  const metric = sortBy === 'paper_count' ? 'paper_count' : 'avg_citations';
  const metricLabel = sortBy === 'paper_count'
    ? tr('pages.journals.papers', 'Papers')
    : tr('pages.journals.avgCitations', 'Avg Citations');
  const sortLabels = {
    paper_count: tr('pages.journals.mostPapers', 'Most Papers'),
    avg_citations: tr('pages.journals.highestAvgCitations', 'Highest Avg Citations'),
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div data-tour="journals" className="flex items-center gap-3 mb-6">
        <BarChart2 size={24} className="text-blue-600 dark:text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{tr('pages.journals.title', 'Journal Analysis')}</h1>
          <p className="text-sm text-slate-500">{tr('pages.journals.subtitle', 'Top publication venues by volume and impact')}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSortBy(opt.value)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                sortBy === opt.value
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {opt.value === 'paper_count' ? <BookOpen size={14} /> : <TrendingUp size={14} />}
              {sortLabels[opt.value] ?? opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <label className="text-xs text-slate-500">{tr('pages.journals.showTop', 'Show top')}</label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="text-sm px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            {[10, 20, 25, 30].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <label className="text-xs text-slate-500">{tr('pages.journals.journalsUnit', 'journals')}</label>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-blue-500" />
        </div>
      ) : (
        <>
          {/* Chart */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 mb-6">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
              {tr('pages.journals.top', 'Top')} {data.length} {tr('pages.journals.journalsWord', 'Journals')} — {metricLabel}
            </h2>
            <ResponsiveContainer width="100%" height={Math.max(300, data.length * 28)}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 32 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="shortName"
                  width={200}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white rounded-lg px-3 py-2 text-xs shadow-xl">
                        <p className="font-semibold mb-1 max-w-xs">{d.journal}</p>
                        <p>{d.paper_count.toLocaleString()} {tr('pages.journals.papersUnit', 'papers')}</p>
                        <p>{tr('pages.journals.avg', 'Avg')} {d.avg_citations} {tr('pages.journals.citations', 'citations')}</p>
                        <p>{tr('pages.journals.max', 'Max')} {d.max_citations?.toLocaleString()} {tr('pages.journals.citations', 'citations')}</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey={metric} radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{tr('pages.journals.detailedRankings', 'Detailed Rankings')}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 w-10">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">{tr('pages.journals.journalVenue', 'Journal / Venue')}</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">{tr('pages.journals.papers', 'Papers')}</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">{tr('pages.journals.avgCitations', 'Avg Citations')}</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">{tr('pages.journals.maxCitations', 'Max Citations')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {data.map((row, i) => (
                    <tr
                      key={row.journal}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors"
                      onClick={() => navigate(`/?q=${encodeURIComponent(row.journal)}`)}
                      title={`${tr('pages.journals.searchPapersFrom', 'Search papers from')} ${row.journal}`}
                    >
                      <td className="px-4 py-3 text-slate-400 dark:text-slate-500 font-mono text-xs">{i + 1}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-900 dark:text-white">{row.journal}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-slate-900 dark:text-white">{row.paper_count.toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-amber-600 dark:text-amber-400 font-medium">{row.avg_citations}</td>
                      <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400">{row.max_citations?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
