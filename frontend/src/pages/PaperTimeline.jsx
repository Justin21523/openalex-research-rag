import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, BookMarked, ChevronLeft, ChevronRight, Loader2, Star } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { api } from '../api/client.js';
import { useT } from '../i18n/LanguageContext.jsx';

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 2000;

export default function PaperTimeline() {
  const tr = useT();
  const [selectedYear, setSelectedYear] = useState(2023);
  const [concept, setConcept] = useState('');
  const [concepts, setConcepts] = useState([]);
  const [papers, setPapers] = useState(null);
  const [yearDist, setYearDist] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.getTopConcepts(30).then((res) => {
      const arr = Array.isArray(res) ? res : (res?.concepts ?? []);
      setConcepts(arr);
    }).catch(() => {});
    api.getYearDistribution().then((res) =>
      setYearDist(res.filter((r) => r.year >= MIN_YEAR && r.year <= CURRENT_YEAR))
    ).catch(() => {});
  }, []);

  const loadYear = useCallback(async (year, conceptFilter = concept) => {
    setLoading(true);
    try {
      const res = await api.getPaperTimeline(year, conceptFilter || undefined, 25);
      setPapers(res);
    } catch (e) {
      setPapers([]);
    } finally {
      setLoading(false);
    }
  }, [concept]);

  useEffect(() => { loadYear(selectedYear); }, [selectedYear]);

  const handleConceptChange = (c) => {
    setConcept(c);
    loadYear(selectedYear, c);
  };

  const maxCount = yearDist.length > 0 ? Math.max(...yearDist.map((r) => r.count)) : 1;

  return (
    <div className="max-w-5xl mx-auto">
      <div data-tour="timeline" className="flex items-center gap-3 mb-6">
        <Calendar size={24} className="text-blue-600 dark:text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{tr('pages.timeline.title', 'Paper Timeline')}</h1>
          <p className="text-slate-500 text-sm">{tr('pages.timeline.subtitle', 'Browse top-cited papers by year')}</p>
        </div>
      </div>

      {/* Year distribution bar chart */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 mb-5">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">{tr('pages.timeline.papersPerYear', 'Papers per Year — click to navigate')}</h2>
        {yearDist.length > 0 ? (
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={yearDist} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="year" tick={{ fontSize: 10 }} interval={2} />
              <YAxis tick={{ fontSize: 10 }} width={40} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [v.toLocaleString(), tr('pages.timeline.papers', 'papers')]} />
              <Bar
                dataKey="count"
                radius={[2, 2, 0, 0]}
                cursor="pointer"
                onClick={(d) => setSelectedYear(d.year)}
              >
                {yearDist.map((entry) => (
                  <Cell
                    key={entry.year}
                    fill={entry.year === selectedYear ? '#2563eb' : '#93c5fd'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-28">
            <Loader2 size={20} className="animate-spin text-slate-400" />
          </div>
        )}
      </div>

      {/* Year nav + concept filter */}
      <div className="flex items-center gap-4 mb-5">
        <button
          onClick={() => setSelectedYear((y) => Math.max(MIN_YEAR, y - 1))}
          disabled={selectedYear <= MIN_YEAR}
          className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1 flex items-center justify-center gap-3">
          <span className="text-2xl font-bold text-slate-900 dark:text-white">{selectedYear}</span>
          <input
            type="range"
            min={MIN_YEAR}
            max={CURRENT_YEAR}
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="w-48"
          />
        </div>
        <button
          onClick={() => setSelectedYear((y) => Math.min(CURRENT_YEAR, y + 1))}
          disabled={selectedYear >= CURRENT_YEAR}
          className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
        >
          <ChevronRight size={16} />
        </button>

        <select
          value={concept}
          onChange={(e) => handleConceptChange(e.target.value)}
          className="ml-4 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{tr('pages.timeline.allConcepts', 'All concepts')}</option>
          {concepts.map((c) => (
            <option key={c.concept_name} value={c.concept_name}>
              {c.concept_name} ({c.work_count?.toLocaleString()})
            </option>
          ))}
        </select>
      </div>

      {/* Papers list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin text-blue-500" />
        </div>
      ) : papers !== null && papers.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Calendar size={40} className="mx-auto mb-3 opacity-30" />
          <p>{tr('pages.timeline.noPapersFoundFor', 'No papers found for')} {selectedYear}{concept ? ` ${tr('pages.timeline.in', 'in')} "${concept}"` : ''}.</p>
        </div>
      ) : papers !== null && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400 mb-3">
            {tr('pages.timeline.top', 'Top')} {papers.length} {tr('pages.timeline.mostCitedPapersIn', 'most-cited papers in')} {selectedYear}
            {concept && <span className="ml-1 text-blue-600 font-medium">· {concept}</span>}
          </p>
          {papers.map((p, i) => (
            <div
              key={p.work_id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-start gap-3 hover:shadow-sm transition-shadow cursor-pointer"
              onClick={() => navigate(`/works/${p.work_id}`)}
            >
              <span className="text-sm font-bold text-slate-300 dark:text-slate-600 w-7 shrink-0 pt-0.5 text-right">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white line-clamp-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  {p.title || p.work_id}
                </p>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                  {p.top_concept && (
                    <span className="px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium">
                      {p.top_concept}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Star size={12} className="text-amber-400" />
                <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                  {p.cited_by_count.toLocaleString()}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  api.addToReadingList(p.work_id).catch(() => {});
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors shrink-0"
                title={tr('pages.timeline.addToReadingList', 'Add to reading list')}
              >
                <BookMarked size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
