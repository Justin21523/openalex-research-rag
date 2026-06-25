import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Network, Grid3X3, AreaChart, Newspaper, Loader2, Flame } from 'lucide-react';
import { api, streamTopicDigest } from '../api/client.js';
import { TrendChart } from '../components/charts/TrendChart.jsx';
import { ConceptNetwork } from '../components/charts/ConceptNetwork.jsx';
import { ConceptHeatmap } from '../components/charts/ConceptHeatmap.jsx';
import { ClusterViz } from '../components/charts/ClusterViz.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { Spinner, PageSpinner } from '../components/ui/Spinner.jsx';
import { ErrorAlert } from '../components/ui/EmptyState.jsx';
import Markdown from '../components/ui/Markdown.jsx';
import { useT } from '../i18n/LanguageContext.jsx';

const RECENT_YEARS = [2022, 2023, 2024];
const OLDER_YEARS  = [2018, 2019, 2020, 2021];

function EmergingTopicsPanel() {
  const [items, setItems] = useState(null);
  const navigate = useNavigate();
  const tr = useT();

  useEffect(() => {
    async function load() {
      try {
        const concepts = await api.getTopConcepts(20);
        const filtered = (concepts ?? []).filter(
          (c) => !['Computer science','Mathematics','Philosophy','Biology','Physics',
                    'Chemistry','Medicine','Law','Psychology','Archaeology'].includes(c.concept_name)
        ).slice(0, 15);
        const results = await Promise.all(
          filtered.map(async (c) => {
            try {
              const trends = await api.getTopicTrends({ concept: c.concept_name, year_from: 2015, year_to: 2024 });
              const byYear = Object.fromEntries((trends ?? []).map((t) => [t.year, t.count]));
              const recent = RECENT_YEARS.reduce((s, y) => s + (byYear[y] || 0), 0);
              const older  = OLDER_YEARS.reduce((s, y) => s + (byYear[y] || 0), 0);
              const growth = older === 0 ? (recent > 0 ? 999 : 0) : Math.round(((recent - older) / older) * 100);
              return { concept: c.concept_name, growth, recent };
            } catch { return null; }
          })
        );
        const sorted = results.filter(Boolean).filter((r) => r.growth > 0).sort((a, b) => b.growth - a.growth);
        setItems(sorted.slice(0, 6));
      } catch { setItems([]); }
    }
    load();
  }, []);

  if (items === null) return (
    <div className="flex items-center gap-2 text-sm text-slate-400 py-3 px-5 bg-white rounded-2xl border border-slate-200">
      <Loader2 size={14} className="animate-spin" /> {tr('pages.topics.computingEmergingTopics', 'Computing emerging topics…')}
    </div>
  );
  if (items.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
        <Flame size={15} className="text-orange-500" />
        {tr('pages.topics.emergingTopics', 'Emerging Topics')}
        <span className="text-xs font-normal text-slate-400 ml-1">{tr('pages.topics.emergingGrowthLabel', '2022–24 vs 2018–21 growth')}</span>
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {items.map((item) => (
          <button
            key={item.concept}
            onClick={() => navigate(`/velocity`)}
            className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors text-left"
          >
            <span className="text-sm text-slate-700 truncate flex-1">{item.concept}</span>
            <span className="text-xs font-bold text-emerald-600 ml-2 shrink-0">
              +{item.growth === 999 ? '∞' : item.growth}%
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

const TABS = [
  { key: 'trends',  label: 'Publication Trends',  icon: TrendingUp },
  { key: 'network', label: 'Concept Network',      icon: Network    },
  { key: 'heatmap', label: 'Concept Heatmap',      icon: Grid3X3   },
  { key: 'cluster', label: 'Paper Cluster',         icon: AreaChart },
];

export default function TopicTrends() {
  const tr = useT();
  const [concepts, setConcepts] = useState([]);
  const [selectedConcept, setSelectedConcept] = useState('');
  const [yearFrom, setYearFrom] = useState(2015);
  const [yearTo, setYearTo] = useState(2024);
  const [tab, setTab] = useState('trends');

  const [trendData, setTrendData] = useState(null);
  const [coData, setCoData] = useState(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const [coLoading, setCoLoading] = useState(false);
  const [error, setError] = useState(null);
  const [digestText, setDigestText] = useState('');
  const [digestLoading, setDigestLoading] = useState(false);

  useEffect(() => {
    api.getTopConcepts(40)
      .then((res) => setConcepts(Array.isArray(res) ? res : (res?.concepts ?? [])))
      .catch(() => {});
  }, []);

  const loadTrends = async () => {
    setTrendLoading(true);
    setError(null);
    try {
      const res = await api.getTopicTrends({
        concept: selectedConcept || undefined,
        year_from: yearFrom,
        year_to: yearTo,
      });
      setTrendData(Array.isArray(res) ? res : (res?.trends ?? []));
    } catch (e) {
      setError(e.message);
    } finally {
      setTrendLoading(false);
    }
  };

  const loadCooccurrence = async () => {
    setCoLoading(true);
    setError(null);
    try {
      const res = await api.getConceptCooccurrence(25, 1);
      setCoData(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setCoLoading(false);
    }
  };

  useEffect(() => {
    loadTrends();
  }, []);

  useEffect(() => {
    if (tab === 'network' && !coData) loadCooccurrence();
  }, [tab]);

  const generateDigest = async () => {
    const concept = selectedConcept || 'machine learning';
    setDigestLoading(true);
    setDigestText('');
    try {
      for await (const event of streamTopicDigest(concept)) {
        if (event.type === 'token') setDigestText((p) => p + event.content);
        else if (event.type === 'done') setDigestText((p) => p || event.answer_text || '');
      }
    } catch (e) {
      setDigestText(`Error: ${e.message}`);
    } finally {
      setDigestLoading(false);
    }
  };

  const tabLabels = {
    trends: tr('pages.topics.tabPublicationTrends', 'Publication Trends'),
    network: tr('pages.topics.tabConceptNetwork', 'Concept Network'),
    heatmap: tr('pages.topics.tabConceptHeatmap', 'Concept Heatmap'),
    cluster: tr('pages.topics.tabPaperCluster', 'Paper Cluster'),
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div data-tour="topics" className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">{tr('pages.topics.title', 'Topic Trends')}</h1>
        <p className="text-slate-500 text-sm">{tr('pages.topics.subtitle', 'Publication trends by concept and concept co-occurrence network')}</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4 flex flex-wrap gap-4">
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium text-slate-500 mb-1.5">{tr('pages.topics.conceptFilter', 'Concept filter')}</label>
          <select
            value={selectedConcept}
            onChange={(e) => setSelectedConcept(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{tr('pages.topics.allConcepts', 'All concepts')}</option>
            {concepts.map((c) => (
              <option key={c.concept_name} value={c.concept_name}>
                {c.concept_name} ({c.work_count})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">{tr('pages.topics.yearFrom', 'Year from')}</label>
          <input
            type="number" value={yearFrom}
            onChange={(e) => setYearFrom(+e.target.value)}
            className="w-24 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">{tr('pages.topics.yearTo', 'Year to')}</label>
          <input
            type="number" value={yearTo}
            onChange={(e) => setYearTo(+e.target.value)}
            className="w-24 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-end">
          <button
            onClick={loadTrends}
            disabled={trendLoading}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {trendLoading ? <Spinner size="sm" /> : <TrendingUp size={15} />}
            {tr('pages.topics.apply', 'Apply')}
          </button>
        </div>
      </div>

      {error && <ErrorAlert message={error} />}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-slate-100 rounded-xl p-1 w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={15} />
            {tabLabels[key] ?? label}
          </button>
        ))}
      </div>

      {/* Trend chart */}
      {tab === 'trends' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            {trendLoading ? (
              <PageSpinner />
            ) : (
              <>
                {trendData && (
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-900">
                      {selectedConcept || tr('pages.topics.allResearch', 'All Research')} — {tr('pages.topics.publicationTrend', 'Publication Trend')}
                    </h3>
                    <Badge variant="slate">{trendData.length} {tr('pages.topics.years', 'years')}</Badge>
                  </div>
                )}
                <TrendChart data={trendData ?? []} />
              </>
            )}
          </div>

          {/* Emerging Topics panel */}
          {!selectedConcept && trendData !== null && (
            <EmergingTopicsPanel />
          )}
        </div>
      )}

      {/* Concept network */}
      {tab === 'network' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">{tr('pages.topics.conceptCooccurrenceNetwork', 'Concept Co-occurrence Network')}</h3>
            {coData && (
              <Badge variant="slate">{coData.nodes?.length} {tr('pages.topics.concepts', 'concepts')} · {coData.edges?.length} {tr('pages.topics.edges', 'edges')}</Badge>
            )}
          </div>
          {coLoading ? (
            <PageSpinner />
          ) : (
            <ConceptNetwork
              nodes={coData?.nodes ?? []}
              edges={coData?.edges ?? []}
            />
          )}
        </div>
      )}

      {/* Concept heatmap */}
      {tab === 'heatmap' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">{tr('pages.topics.conceptYearHeatmap', 'Concept × Year Heatmap')}</h3>
            <Badge variant="slate">{yearFrom}–{yearTo}</Badge>
          </div>
          <ConceptHeatmap topN={15} yearFrom={yearFrom} yearTo={yearTo} />
        </div>
      )}

      {/* Paper Cluster (UMAP) */}
      {tab === 'cluster' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-white">{tr('pages.topics.paperCluster2dUmap', 'Paper Cluster (2D UMAP)')}</h3>
            <Badge variant="slate">{tr('pages.topics.semanticEmbeddingProjection', 'Semantic embedding projection')}</Badge>
          </div>
          <ClusterViz topN={3000} />
        </div>
      )}

      {/* Topic Digest panel */}
      {tab === 'trends' && (
        <div className="mt-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Newspaper size={16} className="text-blue-500" />
              {tr('pages.topics.topicDigest', 'Topic Digest')}
            </h3>
            <button
              onClick={generateDigest}
              disabled={digestLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium disabled:opacity-50 transition-colors"
            >
              {digestLoading ? <Loader2 size={13} className="animate-spin" /> : <Newspaper size={13} />}
              {tr('pages.topics.generateDigest', 'Generate Digest')}{selectedConcept ? ` ${tr('pages.topics.for', 'for')} "${selectedConcept}"` : ''}
            </button>
          </div>
          {digestText && <Markdown text={digestText} streaming={digestLoading} />}
          {!digestText && !digestLoading && (
            <p className="text-sm text-slate-400">{tr('pages.topics.digestHint', 'Click "Generate Digest" to get an AI summary of recent papers on the selected topic.')}</p>
          )}
        </div>
      )}
    </div>
  );
}
