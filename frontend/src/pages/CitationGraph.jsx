import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, GitBranch, ChevronLeft, Star } from 'lucide-react';
import { api } from '../api/client.js';
import { CitationNetwork } from '../components/charts/CitationNetwork.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';
import { EmptyState, ErrorAlert } from '../components/ui/EmptyState.jsx';
import Combobox from '../components/ui/Combobox.jsx';
import { useT } from '../i18n/LanguageContext.jsx';

const DIRECTIONS = ['both', 'in', 'out'];

export default function CitationGraph() {
  const t = useT();
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [selectedWork, setSelectedWork] = useState(null);
  const [direction, setDirection] = useState('both');
  const [limit] = useState(20);
  const [graph, setGraph] = useState(null);
  const [loading, setLoading] = useState(false);
  const [graphLoading, setGraphLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]); // breadcrumb stack
  const [filterYearMin, setFilterYearMin] = useState('');
  const [filterYearMax, setFilterYearMax] = useState('');
  const [featured, setFeatured] = useState([]);

  // Auto-load from ?focus= query param
  useEffect(() => {
    const focusId = searchParams.get('focus');
    if (focusId) {
      loadGraph({ work_id: focusId, title: focusId });
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    api.getTopWorks(12).then((res) => setFeatured(Array.isArray(res) ? res : [])).catch(() => {});
  }, []);

  const doSearch = async (query = q) => {
    if (!query.trim()) return;
    setQ(query);
    setLoading(true);
    setError(null);
    setSelectedWork(null);
    setGraph(null);
    setHistory([]);
    try {
      const res = await api.search(query, { k: 8, mode: 'bm25' });
      setSearchResults(res.results ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadGraph = async (work, dir = direction, pushHistory = false) => {
    if (pushHistory && selectedWork) {
      setHistory((h) => [...h, selectedWork]);
    }
    setSelectedWork(work);
    setGraphLoading(true);
    setGraph(null);
    try {
      const res = await api.getCitations(work.work_id, dir, limit);
      setGraph(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setGraphLoading(false);
    }
  };

  const handleDirectionChange = (d) => {
    setDirection(d);
    if (selectedWork) loadGraph(selectedWork, d);
  };

  const goBack = () => {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    loadGraph(prev, direction, false);
  };

  const onNodeClick = (workId, title) => {
    loadGraph({ work_id: workId, title: title || workId }, direction, true);
  };

  const filterByYear = (works) => works.filter((w) => {
    const y = w.publication_year ?? 0;
    if (filterYearMin && y < Number(filterYearMin)) return false;
    if (filterYearMax && y > Number(filterYearMax)) return false;
    return true;
  });

  const citingWorks = filterByYear(graph?.citing ?? []);
  const citedWorks = filterByYear(graph?.cited ?? []);
  const totalCiting = graph?.total_citing ?? graph?.citing?.length ?? 0;
  const totalCited = graph?.total_cited ?? graph?.cited?.length ?? 0;

  return (
    <div className="max-w-5xl mx-auto">
      <div data-tour="citations" className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">{t('pages.citations.title', 'Citation Graph')}</h1>
        <p className="text-slate-500 text-sm">{t('pages.citations.subtitle', 'Visualise citing and cited relationships — click any node to explore')}</p>
      </div>

      {/* Search — combobox with top-cited paper presets */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 mb-4">
        <Combobox
          placeholder={t('pages.citations.searchPlaceholder', 'Pick a popular paper or type to search…')}
          topLabel={t('pages.citations.topLabel', 'Most-cited papers')}
          fetchTop={() => api.getTopWorks(20)}
          fetchSearch={(query) => api.search(query, { k: 8, mode: 'bm25' }).then((r) => r.results ?? [])}
          getKey={(w) => w.work_id}
          renderOption={(w) => (
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-200 line-clamp-2">{w.title || w.work_id}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {w.publication_year ? `${w.publication_year} · ` : ''}{(w.cited_by_count ?? 0).toLocaleString()} {t('pages.citations.cited', 'cited')}
              </p>
            </div>
          )}
          onSelect={(w) => { setSearchResults([w]); setHistory([]); loadGraph(w); }}
          onSubmit={(text) => doSearch(text)}
        />
      </div>

      {error && <ErrorAlert message={error} />}

      <div className="flex gap-4">
        {/* Paper list */}
        {searchResults !== null && (
          <div className="w-72 shrink-0 space-y-2">
            <p className="text-xs font-medium text-slate-400 px-1">{t('pages.citations.selectPaperLabel', 'Select a paper:')}</p>
            {searchResults.length === 0 ? (
              <EmptyState icon={GitBranch} title={t('pages.citations.noPapersFound', 'No papers found')} />
            ) : (
              searchResults.map((w) => (
                <button
                  key={w.work_id}
                  onClick={() => { setHistory([]); loadGraph(w); }}
                  className={`w-full text-left p-3 rounded-xl border transition-colors ${
                    selectedWork?.work_id === w.work_id
                      ? 'bg-blue-50 border-blue-300'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 mb-1">
                    {w.title}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="slate">{w.publication_year}</Badge>
                    <Badge variant="amber">{w.cited_by_count?.toLocaleString()} cited</Badge>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* Graph area */}
        <div className="flex-1 min-w-0">
          {selectedWork && (
            <div className="mb-3 space-y-2">
              {/* Breadcrumb */}
              {history.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-500">
                  <button
                    onClick={goBack}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600"
                  >
                    <ChevronLeft size={12} /> {t('pages.citations.back', 'Back')}
                  </button>
                  {history.map((h, i) => (
                    <span key={i} className="truncate max-w-[120px] text-slate-400">
                      {(h.title || h.work_id).slice(0, 20)}…
                    </span>
                  ))}
                  <span className="text-slate-300">›</span>
                  <span className="text-slate-700 font-medium truncate max-w-[160px]">
                    {(selectedWork.title || selectedWork.work_id).slice(0, 30)}
                  </span>
                </div>
              )}

              {/* Controls row */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex gap-1">
                  {DIRECTIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => handleDirectionChange(d)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                        direction === d
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {d === 'in' ? `← ${t('pages.citations.directionCiting', 'Citing')}` : d === 'out' ? `${t('pages.citations.directionCited', 'Cited')} →` : `↔ ${t('pages.citations.directionBoth', 'Both')}`}
                    </button>
                  ))}
                </div>

                {/* Year filter */}
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span>{t('pages.citations.year', 'Year:')}</span>
                  <input
                    type="number" placeholder={t('pages.citations.yearFrom', 'From')} value={filterYearMin}
                    onChange={(e) => setFilterYearMin(e.target.value)}
                    className="w-16 px-1.5 py-1 rounded border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  <span>–</span>
                  <input
                    type="number" placeholder={t('pages.citations.yearTo', 'To')} value={filterYearMax}
                    onChange={(e) => setFilterYearMax(e.target.value)}
                    className="w-16 px-1.5 py-1 rounded border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  {(filterYearMin || filterYearMax) && (
                    <button
                      onClick={() => { setFilterYearMin(''); setFilterYearMax(''); }}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >✕</button>
                  )}
                </div>

                {graph && (
                  <div className="flex gap-2 text-xs text-slate-500 ml-auto">
                    <Badge variant="blue">
                      {citingWorks.length}{totalCiting !== citingWorks.length ? `/${totalCiting}` : ''} {t('pages.citations.citingLabel', 'citing')}
                    </Badge>
                    <Badge variant="green">
                      {citedWorks.length}{totalCited !== citedWorks.length ? `/${totalCited}` : ''} {t('pages.citations.citedLabel', 'cited')}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          )}

          {graphLoading && (
            <div className="flex justify-center py-20"><Spinner size="lg" /></div>
          )}

          {!graphLoading && graph && (
            <div className="bg-slate-900 rounded-2xl overflow-hidden">
              <CitationNetwork
                center={selectedWork}
                citingWorks={citingWorks}
                citedWorks={citedWorks}
                onNodeClick={onNodeClick}
              />
            </div>
          )}

          {!graphLoading && !selectedWork && (
            searchResults === null ? (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Star size={15} className="text-amber-500" />
                  <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('pages.citations.popularPapers', 'Popular papers to explore')}</h2>
                  <span className="text-xs text-slate-400">{t('pages.citations.popularPapersHint', 'click to open its citation network')}</span>
                </div>
                {featured.length === 0 ? (
                  <div className="flex justify-center py-12"><Spinner /></div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {featured.map((w) => (
                      <button
                        key={w.work_id}
                        onClick={() => { setSearchResults([w]); setHistory([]); loadGraph(w); }}
                        className="text-left p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:shadow-md hover:border-blue-300 transition-all"
                      >
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 mb-2">{w.title || w.work_id}</p>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="slate">{w.publication_year}</Badge>
                          <Badge variant="amber">{(w.cited_by_count ?? 0).toLocaleString()} {t('pages.citations.cited', 'cited')}</Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                icon={GitBranch}
                title={t('pages.citations.selectPaperTitle', 'Select a paper')}
                description={t('pages.citations.selectPaperDesc', 'Click a paper from the list to see its citation network — then click any node to explore further')}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}
