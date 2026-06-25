import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Star, Cpu, Database, TrendingUp, BarChart2, Search, Loader2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '../api/client.js';
import { useT } from '../i18n/LanguageContext.jsx';

function StatCard({ icon: Icon, label, value, sub, color = 'text-blue-600', onClick }) {
  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className={color} />
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-3xl font-bold text-slate-900 dark:text-white">{value ?? <Loader2 size={20} className="animate-spin text-slate-400" />}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const [health, setHealth] = useState(null);
  const [concepts, setConcepts] = useState([]);
  const [journals, setJournals] = useState([]);
  const [yearDist, setYearDist] = useState([]);
  const navigate = useNavigate();
  const t = useT();

  useEffect(() => {
    api.health().then(setHealth).catch(() => {});
    api.getTopConcepts(10).then((res) => {
      const arr = Array.isArray(res) ? res : (res?.concepts ?? []);
      setConcepts(arr.slice(0, 10));
    }).catch(() => {});
    api.getJournalStats(5, 'paper_count').then(setJournals).catch(() => {});
    api.getYearDistribution().then((res) => setYearDist(res.filter((r) => r.year >= 2010))).catch(() => {});
  }, []);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{t('dashboard.title')}</h1>
        <p className="text-slate-500 text-sm">
          {health ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /> {t('dashboard.apiOnline')}
            </span>
          ) : <span className="text-slate-400">{t('common.connecting')}</span>}
        </p>
      </div>

      {/* Top stat cards */}
      <div data-tour="dashboard-stats" className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={BookOpen} label={t('dashboard.statsPapers')} color="text-blue-600"
          value={health?.works_count?.toLocaleString()}
          sub={t('dashboard.statsPapersSub')}
          onClick={() => navigate('/search')}
        />
        <StatCard
          icon={Database} label={t('dashboard.statsVectors')} color="text-purple-600"
          value={health?.chromadb_count?.toLocaleString()}
          sub={t('dashboard.statsVectorsSub')}
        />
        <StatCard
          icon={Cpu} label={t('dashboard.statsBm25')} color="text-emerald-600"
          value={health?.bm25_ready ? t('common.ready') : t('common.building')}
          sub={health?.bm25_ready ? t('dashboard.statsBm25ReadySub') : t('dashboard.statsBm25BuildingSub')}
        />
        <StatCard
          icon={TrendingUp} label={t('dashboard.statsLlm')} color="text-amber-500"
          value={health?.llm_available ? t('common.online') : t('common.offline')}
          sub={health?.llm_available ? t('dashboard.statsLlmOnSub') : t('dashboard.statsLlmOffSub')}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Year distribution */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <TrendingUp size={14} className="text-blue-500" /> {t('dashboard.yearChart')}
          </h2>
          {yearDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={yearDist} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="year" tick={{ fontSize: 10 }} interval={2} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40">
              <Loader2 size={20} className="animate-spin text-slate-400" />
            </div>
          )}
        </div>

        {/* Top concepts */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <BarChart2 size={14} className="text-purple-500" /> {t('dashboard.topConcepts')}
          </h2>
          {concepts.length > 0 ? (
            <div className="space-y-2">
              {concepts.map((c, i) => {
                const max = concepts[0]?.work_count || 1;
                const pct = Math.round((c.work_count / max) * 100);
                return (
                  <div key={c.concept_name}
                    className="cursor-pointer group"
                    onClick={() => navigate(`/topics?concept=${encodeURIComponent(c.concept_name)}`)}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors truncate flex-1">
                        {i + 1}. {c.concept_name}
                      </span>
                      <span className="text-xs text-slate-400 ml-2 shrink-0">{c.work_count.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700">
                      <div
                        className="h-1.5 rounded-full bg-blue-500 group-hover:bg-blue-600 transition-colors"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-40">
              <Loader2 size={20} className="animate-spin text-slate-400" />
            </div>
          )}
        </div>
      </div>

      {/* Top journals */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <BarChart2 size={14} className="text-emerald-500" /> {t('dashboard.topVenues')}
          </h2>
          <button onClick={() => navigate('/journals')} className="text-xs text-blue-500 hover:underline">
            {t('common.viewAll')} →
          </button>
        </div>
        {journals.length > 0 ? (
          <div className="space-y-2">
            {journals.map((j, i) => (
              <div key={j.journal} className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-5 shrink-0">{i + 1}</span>
                <span className="text-sm text-slate-700 dark:text-slate-300 flex-1 truncate">{j.journal}</span>
                <span className="text-xs font-semibold text-slate-900 dark:text-white shrink-0">{j.paper_count.toLocaleString()} papers</span>
                <span className="text-xs text-amber-600 dark:text-amber-400 shrink-0">avg {j.avg_citations} cited</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-slate-400" />
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t('dashboard.quickSearch'), icon: Search, to: '/search', color: 'bg-blue-600 hover:bg-blue-700' },
          { label: t('dashboard.quickRag'), icon: Cpu, to: '/rag', color: 'bg-purple-600 hover:bg-purple-700' },
          { label: t('dashboard.quickTopics'), icon: TrendingUp, to: '/topics', color: 'bg-emerald-600 hover:bg-emerald-700' },
          { label: t('dashboard.quickReview'), icon: BookOpen, to: '/literature-review', color: 'bg-amber-600 hover:bg-amber-700' },
        ].map(({ label, icon: Icon, to, color }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-medium transition-colors ${color}`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
    </div>
  );
}
