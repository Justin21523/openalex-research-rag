import { useState, useEffect, useMemo } from 'react';
import {
  Search, SlidersHorizontal, Download, X, CheckSquare, Columns, ArrowUpDown,
  Layers, Cpu, FileText, Database, Filter, ChevronDown, ChevronUp,
} from 'lucide-react';
import { api } from '../api/client.js';
import { WorkCard } from '../components/ui/WorkCard.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';
import { EmptyState, ErrorAlert } from '../components/ui/EmptyState.jsx';
import CompareModal from '../components/CompareModal.jsx';
import { useT } from '../i18n/LanguageContext.jsx';

const EXPORT_FORMATS = ['csv', 'bibtex', 'json', 'markdown'];

const MODE_CONFIG = [
  { key: 'hybrid', icon: Layers,   label: 'Hybrid',  desc: 'BM25 + vector fusion — best coverage'  },
  { key: 'bm25',   icon: FileText, label: 'BM25',    desc: 'Keyword-based sparse retrieval'         },
  { key: 'vector', icon: Cpu,      label: 'Vector',  desc: 'Semantic dense retrieval'               },
  { key: 'fts',    icon: Database, label: 'FTS',     desc: 'DuckDB exact full-text search'          },
];

const YEAR_PRESETS = [
  { label: 'All',   from: '',     to: '' },
  { label: '2020+', from: '2020', to: '' },
  { label: '2015+', from: '2015', to: '' },
  { label: '2010+', from: '2010', to: '' },
];

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'citations', label: 'Most Cited' },
  { value: 'year_desc', label: 'Newest' },
  { value: 'year_asc',  label: 'Oldest' },
];

const CITATION_PRESETS = [
  { label: 'Any',   min: 0,    max: Infinity },
  { label: '10+',   min: 10,   max: Infinity },
  { label: '50+',   min: 50,   max: Infinity },
  { label: '100+',  min: 100,  max: Infinity },
  { label: '500+',  min: 500,  max: Infinity },
];

const TYPE_LABELS = {
  'journal-article': 'Journal Article',
  'preprint':        'Preprint',
  'dataset':         'Dataset',
  'book-chapter':    'Book Chapter',
  'dissertation':    'Dissertation',
  'report':          'Report',
  'other':           'Other',
};

const LANG_LABELS = {
  en: 'English', zh: 'Chinese', de: 'German', fr: 'French',
  ja: 'Japanese', es: 'Spanish', pt: 'Portuguese', ar: 'Arabic',
};

const SAMPLES = [
  'transformer attention mechanism',
  'BERT language model pretraining',
  'graph neural network node classification',
  'dense passage retrieval',
  'retrieval augmented generation',
];

// ── Facet accordion section ──────────────────────────────────────────────────
function FacetSection({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-100 dark:border-slate-700 pb-3 mb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2"
      >
        {title}
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && children}
    </div>
  );
}

// ── Facet chip button ─────────────────────────────────────────────────────────
function FacetChip({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left ${
        active
          ? 'bg-blue-600 text-white font-semibold'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
      }`}
    >
      <span className="truncate">{label}</span>
      {count != null && (
        <span className={`ml-1 shrink-0 ${active ? 'text-blue-200' : 'text-slate-400'}`}>
          {count.toLocaleString()}
        </span>
      )}
    </button>
  );
}

export default function PaperSearch() {
  const tr = useT();
  const MODE_DESC = {
    hybrid: tr('pages.search.modeHybridDesc', 'BM25 + vector fusion — best coverage'),
    bm25:   tr('pages.search.modeBm25Desc', 'Keyword-based sparse retrieval'),
    vector: tr('pages.search.modeVectorDesc', 'Semantic dense retrieval'),
    fts:    tr('pages.search.modeFtsDesc', 'DuckDB exact full-text search'),
  };
  const SORT_LABELS = {
    relevance: tr('pages.search.sortRelevance', 'Relevance'),
    citations: tr('pages.search.sortMostCited', 'Most Cited'),
    year_desc: tr('pages.search.sortNewest', 'Newest'),
    year_asc:  tr('pages.search.sortOldest', 'Oldest'),
  };

  // ── Search params ──────────────────────────────────────────────────────────
  const [q, setQ] = useState('');
  const [mode, setMode] = useState('hybrid');
  const [k, setK] = useState(40);
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [concept, setConcept] = useState('');
  const [concepts, setConcepts] = useState([]);
  const [sortBy, setSortBy] = useState('relevance');
  const [showSearchOptions, setShowSearchOptions] = useState(false);

  // ── Facet filters (client-side on results) ─────────────────────────────────
  const [facetTypes, setFacetTypes] = useState(new Set());
  const [facetLangs, setFacetLangs] = useState(new Set());
  const [facetJournals, setFacetJournals] = useState(new Set());
  const [facetCiteMin, setFacetCiteMin] = useState(0);
  const [facetYearMin, setFacetYearMin] = useState(null);
  const [facetYearMax, setFacetYearMax] = useState(null);
  const [facetHasAbstract, setFacetHasAbstract] = useState(false);
  const [facetHasDoi, setFacetHasDoi] = useState(false);
  const [showFacets, setShowFacets] = useState(true);

  // ── Results ────────────────────────────────────────────────────────────────
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [latency, setLatency] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [exportLoading, setExportLoading] = useState(false);
  const [showCompare, setShowCompare] = useState(false);

  useEffect(() => {
    api.getTopConcepts(50).then((res) => setConcepts(Array.isArray(res) ? res : (res?.concepts ?? []))).catch(() => {});
  }, []);

  const toggleSelect = (workId, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(workId); else next.delete(workId);
      return next;
    });
  };

  const exportSelected = async (format) => {
    setExportLoading(true);
    try {
      await api.exportWorks([...selectedIds], format);
    } catch (e) {
      alert(`${tr('pages.search.exportFailed', 'Export failed')}: ${e.message}`);
    } finally {
      setExportLoading(false);
    }
  };

  const doSearch = async (query = q) => {
    const effectiveQuery = concept ? `${query} ${concept}` : query;
    if (!effectiveQuery.trim()) return;
    setLoading(true);
    setError(null);
    setFacetTypes(new Set());
    setFacetLangs(new Set());
    setFacetJournals(new Set());
    setFacetCiteMin(0);
    setFacetYearMin(null);
    setFacetYearMax(null);
    setFacetHasAbstract(false);
    setFacetHasDoi(false);
    const t0 = Date.now();
    try {
      const res = await api.search(effectiveQuery, {
        mode,
        k,
        year_from: yearFrom || undefined,
        year_to: yearTo || undefined,
      });
      setResults(res.results ?? []);
      setLatency(res.latency_ms ?? Date.now() - t0);
      setSortBy('relevance');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Derive facet counts from raw results ──────────────────────────────────
  const facetData = useMemo(() => {
    if (!results) return { types: {}, langs: {}, journals: {}, yearRange: [null, null] };
    const types = {}, langs = {}, journals = {};
    let minY = null, maxY = null;
    for (const r of results) {
      const t = r.work_type || 'other';
      types[t] = (types[t] || 0) + 1;
      const l = r.language || 'en';
      langs[l] = (langs[l] || 0) + 1;
      const j = (r.journal || '').trim();
      if (j) journals[j] = (journals[j] || 0) + 1;
      if (r.publication_year) {
        if (minY === null || r.publication_year < minY) minY = r.publication_year;
        if (maxY === null || r.publication_year > maxY) maxY = r.publication_year;
      }
    }
    return { types, langs, journals, yearRange: [minY, maxY] };
  }, [results]);

  // Effective year bounds for the slider (fall back to full data range)
  const yMin = facetData.yearRange[0];
  const yMax = facetData.yearRange[1];
  const curYearMin = facetYearMin ?? yMin;
  const curYearMax = facetYearMax ?? yMax;

  // ── Apply all facet filters + sort ────────────────────────────────────────
  const filteredResults = useMemo(() => {
    if (!results) return null;
    let arr = results.filter((r) => {
      if (facetTypes.size > 0 && !facetTypes.has(r.work_type || 'other')) return false;
      if (facetLangs.size > 0 && !facetLangs.has(r.language || 'en')) return false;
      if (facetJournals.size > 0 && !facetJournals.has((r.journal || '').trim())) return false;
      if (facetCiteMin > 0 && (r.cited_by_count ?? 0) < facetCiteMin) return false;
      if (facetYearMin !== null && (r.publication_year ?? 0) < facetYearMin) return false;
      if (facetYearMax !== null && (r.publication_year ?? 9999) > facetYearMax) return false;
      if (facetHasAbstract && !(r.abstract && r.abstract.trim())) return false;
      if (facetHasDoi && !r.doi) return false;
      return true;
    });
    if (sortBy === 'citations') arr = [...arr].sort((a, b) => (b.cited_by_count ?? 0) - (a.cited_by_count ?? 0));
    else if (sortBy === 'year_desc') arr = [...arr].sort((a, b) => (b.publication_year ?? 0) - (a.publication_year ?? 0));
    else if (sortBy === 'year_asc')  arr = [...arr].sort((a, b) => (a.publication_year ?? 0) - (b.publication_year ?? 0));
    return arr;
  }, [results, facetTypes, facetLangs, facetJournals, facetCiteMin, facetYearMin, facetYearMax, facetHasAbstract, facetHasDoi, sortBy]);

  const activeFacetCount = facetTypes.size + facetLangs.size + facetJournals.size
    + (facetCiteMin > 0 ? 1 : 0)
    + (facetYearMin !== null || facetYearMax !== null ? 1 : 0)
    + (facetHasAbstract ? 1 : 0) + (facetHasDoi ? 1 : 0);
  const clearFacets = () => {
    setFacetTypes(new Set());
    setFacetLangs(new Set());
    setFacetJournals(new Set());
    setFacetCiteMin(0);
    setFacetYearMin(null);
    setFacetYearMax(null);
    setFacetHasAbstract(false);
    setFacetHasDoi(false);
  };

  const toggleFacetType = (t) => setFacetTypes((prev) => {
    const next = new Set(prev);
    if (next.has(t)) next.delete(t); else next.add(t);
    return next;
  });

  const toggleFacetLang = (l) => setFacetLangs((prev) => {
    const next = new Set(prev);
    if (next.has(l)) next.delete(l); else next.add(l);
    return next;
  });

  const toggleFacetJournal = (j) => setFacetJournals((prev) => {
    const next = new Set(prev);
    if (next.has(j)) next.delete(j); else next.add(j);
    return next;
  });

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{tr('pages.search.title', 'Paper Search')}</h1>
        <p className="text-slate-500 text-sm">{tr('pages.search.subtitle', 'Hybrid BM25 + dense vector search with Reciprocal Rank Fusion')}</p>
      </div>

      {/* Search box */}
      <div data-tour="search-box" className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 mb-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doSearch()}
              placeholder={tr('pages.search.searchPlaceholder', 'Search scholarly papers…')}
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => doSearch()}
            disabled={loading}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Spinner size="sm" /> : <Search size={15} />}
            {tr('pages.search.searchButton', 'Search')}
          </button>
          <button
            onClick={() => setShowSearchOptions((f) => !f)}
            className={`px-3 py-2.5 rounded-lg border text-sm transition-colors ${
              showSearchOptions ? 'bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300' : 'border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
            title={tr('pages.search.searchOptions', 'Search options')}
          >
            <SlidersHorizontal size={15} />
          </button>
        </div>

        {/* Advanced search options */}
        {showSearchOptions && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 space-y-4">
            {/* Mode cards */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">{tr('pages.search.searchMode', 'Search mode')}</label>
              <div className="grid grid-cols-4 gap-2">
                {MODE_CONFIG.map(({ key, icon: Icon, label, desc }) => (
                  <button
                    key={key}
                    onClick={() => setMode(key)}
                    className={`flex flex-col items-start gap-1 px-3 py-2.5 rounded-xl border-2 text-left transition-colors ${
                      mode === key
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon size={13} />
                      <span className="text-xs font-semibold">{label}</span>
                    </div>
                    <span className="text-xs opacity-70 leading-tight">{MODE_DESC[key] ?? desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              {/* Concept filter */}
              <div className="flex-1 min-w-48">
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">{tr('pages.search.conceptFilter', 'Concept filter')}</label>
                <select
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{tr('pages.search.allConcepts', 'All concepts')}</option>
                  {concepts.map((c) => (
                    <option key={c.concept_id ?? c.concept_name} value={c.concept_name}>
                      {c.concept_name} ({c.work_count?.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Year range */}
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">{tr('pages.search.yearRange', 'Year range')}</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {YEAR_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => { setYearFrom(p.from); setYearTo(p.to); }}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        yearFrom === p.from && yearTo === p.to
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                    >
                      {p.label === 'All' ? tr('pages.search.yearAll', 'All') : p.label}
                    </button>
                  ))}
                  <span className="text-slate-300 mx-1">|</span>
                  <input
                    type="number" placeholder={tr('pages.search.yearFrom', 'From')} value={yearFrom}
                    onChange={(e) => setYearFrom(e.target.value)}
                    className="w-20 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-slate-400 text-xs">–</span>
                  <input
                    type="number" placeholder={tr('pages.search.yearTo', 'To')} value={yearTo}
                    onChange={(e) => setYearTo(e.target.value)}
                    className="w-20 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* K results */}
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  {tr('pages.search.resultsCount', 'Results')}: {k}
                </label>
                <input
                  type="range" min={10} max={100} step={10} value={k}
                  onChange={(e) => setK(Number(e.target.value))}
                  className="w-28"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sample queries */}
      {!results && !loading && (
        <div className="mb-6">
          <p className="text-xs font-medium text-slate-400 mb-2">{tr('pages.search.trySampleQuery', 'Try a sample query:')}</p>
          <div className="flex flex-wrap gap-2">
            {SAMPLES.map((s) => (
              <button
                key={s}
                onClick={() => { setQ(s); doSearch(s); }}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-blue-300 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <ErrorAlert message={error} />}

      {/* Results + Facet layout */}
      {filteredResults !== null && !loading && (
        <div className="flex gap-5 pb-20">
          {/* ── Facet panel ── */}
          <div className={`shrink-0 transition-all duration-200 ${showFacets ? 'w-52' : 'w-0 overflow-hidden'}`}>
            {showFacets && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sticky top-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                    <Filter size={12} /> {tr('pages.search.filters', 'Filters')}
                  </span>
                  {activeFacetCount > 0 && (
                    <button onClick={clearFacets} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                      <X size={10} /> {tr('pages.search.clear', 'Clear')} ({activeFacetCount})
                    </button>
                  )}
                </div>

                {/* Document type */}
                {Object.keys(facetData.types).length > 0 && (
                  <FacetSection title={tr('pages.search.documentType', 'Document type')}>
                    {Object.entries(facetData.types)
                      .sort(([, a], [, b]) => b - a)
                      .map(([t, cnt]) => (
                        <FacetChip
                          key={t}
                          label={TYPE_LABELS[t] ?? t}
                          count={cnt}
                          active={facetTypes.has(t)}
                          onClick={() => toggleFacetType(t)}
                        />
                      ))}
                  </FacetSection>
                )}

                {/* Language */}
                {Object.keys(facetData.langs).length > 1 && (
                  <FacetSection title={tr('pages.search.language', 'Language')}>
                    {Object.entries(facetData.langs)
                      .sort(([, a], [, b]) => b - a)
                      .map(([l, cnt]) => (
                        <FacetChip
                          key={l}
                          label={LANG_LABELS[l] ?? l.toUpperCase()}
                          count={cnt}
                          active={facetLangs.has(l)}
                          onClick={() => toggleFacetLang(l)}
                        />
                      ))}
                  </FacetSection>
                )}

                {/* Citation count */}
                <FacetSection title={tr('pages.search.citationCount', 'Citation count')}>
                  {CITATION_PRESETS.map((p) => {
                    const cnt = results?.filter((r) => (r.cited_by_count ?? 0) >= p.min).length;
                    return (
                      <FacetChip
                        key={p.label}
                        label={p.label === 'Any' ? tr('pages.search.citationAny', 'Any') : p.label}
                        count={cnt}
                        active={facetCiteMin === p.min}
                        onClick={() => setFacetCiteMin(p.min)}
                      />
                    );
                  })}
                </FacetSection>

                {/* Publication year range */}
                {yMin !== null && yMax !== null && yMin < yMax && (
                  <FacetSection title={tr('pages.search.publicationYear', 'Publication year')}>
                    <div className="px-1">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{curYearMin}</span>
                        <span className="text-slate-300">—</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{curYearMax}</span>
                      </div>
                      <input
                        type="range" min={yMin} max={yMax} value={curYearMin}
                        onChange={(e) => setFacetYearMin(Math.min(Number(e.target.value), curYearMax))}
                        className="w-full accent-blue-600"
                      />
                      <input
                        type="range" min={yMin} max={yMax} value={curYearMax}
                        onChange={(e) => setFacetYearMax(Math.max(Number(e.target.value), curYearMin))}
                        className="w-full accent-blue-600 -mt-1"
                      />
                      {(facetYearMin !== null || facetYearMax !== null) && (
                        <button
                          onClick={() => { setFacetYearMin(null); setFacetYearMax(null); }}
                          className="text-xs text-blue-500 hover:underline mt-1"
                        >
                          {tr('pages.search.resetYear', 'Reset year')}
                        </button>
                      )}
                    </div>
                  </FacetSection>
                )}

                {/* Journal / venue */}
                {Object.keys(facetData.journals).length > 1 && (
                  <FacetSection title={tr('pages.search.journalVenue', 'Journal / venue')} defaultOpen={false}>
                    {Object.entries(facetData.journals)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 12)
                      .map(([j, cnt]) => (
                        <FacetChip
                          key={j}
                          label={j}
                          count={cnt}
                          active={facetJournals.has(j)}
                          onClick={() => toggleFacetJournal(j)}
                        />
                      ))}
                  </FacetSection>
                )}

                {/* Content completeness */}
                <FacetSection title={tr('pages.search.content', 'Content')}>
                  <FacetChip
                    label={tr('pages.search.hasAbstract', 'Has abstract')}
                    count={results?.filter((r) => r.abstract && r.abstract.trim()).length}
                    active={facetHasAbstract}
                    onClick={() => setFacetHasAbstract((v) => !v)}
                  />
                  <FacetChip
                    label={tr('pages.search.hasDoi', 'Has DOI')}
                    count={results?.filter((r) => r.doi).length}
                    active={facetHasDoi}
                    onClick={() => setFacetHasDoi((v) => !v)}
                  />
                </FacetSection>
              </div>
            )}
          </div>

          {/* ── Results column ── */}
          <div className="flex-1 min-w-0">
            {/* Results header */}
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFacets((f) => !f)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
                    showFacets
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <Filter size={11} />
                  {showFacets ? tr('pages.search.hideFilters', 'Hide filters') : tr('pages.search.showFilters', 'Show filters')}
                  {activeFacetCount > 0 && (
                    <span className="ml-0.5 px-1.5 py-0.5 bg-blue-600 text-white rounded-full text-xs font-bold">{activeFacetCount}</span>
                  )}
                </button>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-900 dark:text-white">{filteredResults.length}</span>
                  {activeFacetCount > 0 && results && ` ${tr('pages.search.of', 'of')} ${results.length}`} {tr('pages.search.resultsLabel', 'results')}
                  {latency != null && (
                    <span> · {latency.toFixed(0)} ms · <span className="font-medium text-slate-700 dark:text-slate-300">{mode}</span></span>
                  )}
                  {concept && <span className="ml-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full text-xs">{concept}</span>}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Sort selector */}
                {filteredResults.length > 1 && (
                  <div className="flex items-center gap-1.5">
                    <ArrowUpDown size={13} className="text-slate-400" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {SORT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{SORT_LABELS[opt.value] ?? opt.label}</option>
                      ))}
                    </select>
                  </div>
                )}
                {filteredResults.length > 0 && (
                  <button
                    onClick={() => {
                      if (selectedIds.size === filteredResults.length) {
                        setSelectedIds(new Set());
                      } else {
                        setSelectedIds(new Set(filteredResults.map((r) => r.work_id)));
                      }
                    }}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 transition-colors"
                  >
                    <CheckSquare size={13} />
                    {selectedIds.size === filteredResults.length ? tr('pages.search.deselectAll', 'Deselect all') : tr('pages.search.selectAll', 'Select all')}
                  </button>
                )}
              </div>
            </div>

            {filteredResults.length === 0 ? (
              <EmptyState
                title={tr('pages.search.noResultsTitle', 'No results match filters')}
                description={activeFacetCount > 0 ? tr('pages.search.noResultsFiltered', 'Try removing some filters.') : tr('pages.search.noResultsQuery', 'Try a different query or change the search mode.')}
              />
            ) : (
              <div className="space-y-3">
                {filteredResults.map((w) => (
                  <WorkCard
                    key={w.work_id}
                    work={w}
                    showScores
                    allowSimilar
                    query={q}
                    selectable
                    selected={selectedIds.has(w.work_id)}
                    onSelect={toggleSelect}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3
                        bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl">
          <span className="text-sm font-medium">{selectedIds.size} {tr('pages.search.selected', 'selected')}</span>

          {selectedIds.size >= 2 && selectedIds.size <= 4 && (
            <button
              onClick={() => setShowCompare(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-medium transition-colors"
            >
              <Columns size={11} /> {tr('pages.search.compare', 'Compare')}
            </button>
          )}

          <div className="flex gap-1.5">
            {EXPORT_FORMATS.map((fmt) => (
              <button
                key={fmt}
                onClick={() => exportSelected(fmt)}
                disabled={exportLoading}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              >
                <Download size={11} />
                {fmt.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-1 text-slate-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {showCompare && (
        <CompareModal
          workIds={[...selectedIds]}
          onClose={() => setShowCompare(false)}
        />
      )}
    </div>
  );
}
