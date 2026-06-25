import { useState, useEffect } from 'react';
import { Building2, Search, Globe, BookOpen, Star, Loader2 } from 'lucide-react';
import { api } from '../api/client.js';
import { Spinner } from '../components/ui/Spinner.jsx';
import { EmptyState, ErrorAlert } from '../components/ui/EmptyState.jsx';
import Combobox from '../components/ui/Combobox.jsx';
import { useT } from '../i18n/LanguageContext.jsx';

const COUNTRY_FLAG = (code) => {
  if (!code) return '';
  return code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
};

const TYPE_COLORS = {
  education:   'bg-blue-100 text-blue-700',
  government:  'bg-emerald-100 text-emerald-700',
  healthcare:  'bg-red-100 text-red-700',
  company:     'bg-purple-100 text-purple-700',
  nonprofit:   'bg-amber-100 text-amber-700',
  facility:    'bg-slate-100 text-slate-700',
  archive:     'bg-orange-100 text-orange-700',
  other:       'bg-slate-100 text-slate-600',
};

function StatCard({ icon: Icon, label, value, color = 'text-blue-600' }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={13} className={color} />
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold text-slate-900 dark:text-white">{value ?? '—'}</p>
    </div>
  );
}

export default function InstitutionExplorer() {
  const t = useT();
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [featured, setFeatured] = useState([]);

  useEffect(() => {
    api.getTopInstitutions(12).then((res) => setFeatured(Array.isArray(res) ? res : [])).catch(() => {});
  }, []);

  const asList = (res) => (Array.isArray(res) ? res : (res?.results ?? []));

  const doSearch = async (query = q) => {
    if (!query.trim()) return;
    setQ(query);
    setLoading(true);
    setError(null);
    setSelected(null);
    try {
      const res = await api.searchInstitutions(query);
      setResults(asList(res));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div data-tour="institutions" className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{t('pages.institutions.title', 'Institution Explorer')}</h1>
        <p className="text-slate-500 text-sm">{t('pages.institutions.subtitle', 'Browse universities, labs, and research organisations in the corpus')}</p>
      </div>

      {/* Search — combobox with top-institution presets */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 mb-4">
        <Combobox
          placeholder={t('pages.institutions.searchPlaceholder', 'Pick a top institution or type a name (e.g. MIT, Stanford)…')}
          topLabel={t('pages.institutions.topLabel', 'Most-cited institutions')}
          fetchTop={() => api.getTopInstitutions(20)}
          fetchSearch={(query) => api.searchInstitutions(query).then(asList)}
          getKey={(inst) => inst.institution_id}
          renderOption={(inst) => (
            <div className="flex items-center gap-2">
              <span className="text-lg shrink-0">{COUNTRY_FLAG(inst.country_code) || '🏛'}</span>
              <div className="min-w-0">
                <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{inst.display_name}</p>
                <p className="text-xs text-slate-400 truncate">
                  {inst.type ? `${inst.type} · ` : ''}{(inst.cited_by_count ?? 0).toLocaleString()} {t('pages.institutions.citations', 'citations')}
                </p>
              </div>
            </div>
          )}
          onSelect={(inst) => { setResults([inst]); setSelected(inst); }}
          onSubmit={(text) => doSearch(text)}
        />
      </div>

      {error && <ErrorAlert message={error} />}

      {results !== null && (
        <div className="flex gap-4">
          {/* Results list */}
          <div className="w-72 shrink-0 space-y-2">
            {results.length === 0 ? (
              <EmptyState icon={Building2} title={t('pages.institutions.noResultsTitle', 'No institutions found')} description={t('pages.institutions.noResultsDesc', 'Try a different name.')} />
            ) : results.map((inst) => (
              <button
                key={inst.institution_id}
                onClick={() => setSelected(inst)}
                className={`w-full text-left p-3 rounded-xl border transition-colors ${
                  selected?.institution_id === inst.institution_id
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg shrink-0 mt-0.5">{COUNTRY_FLAG(inst.country_code) || '🏛'}</span>
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-slate-900 dark:text-white truncate">{inst.display_name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {inst.type && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${TYPE_COLORS[inst.type] ?? TYPE_COLORS.other}`}>
                          {inst.type}
                        </span>
                      )}
                      {inst.country_code && (
                        <span className="text-xs text-slate-400">{inst.country_code.toUpperCase()}</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Detail panel */}
          <div className="flex-1 min-w-0">
            {selected ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                {/* Header */}
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-2xl shrink-0">
                    {COUNTRY_FLAG(selected.country_code) || '🏛'}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selected.display_name}</h2>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {selected.type && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${TYPE_COLORS[selected.type] ?? TYPE_COLORS.other}`}>
                          {selected.type}
                        </span>
                      )}
                      {selected.country_code && (
                        <span className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                          <Globe size={12} /> {selected.country_code.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-1">{selected.institution_id}</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <StatCard icon={BookOpen} label={t('pages.institutions.worksInCorpus', 'Works in Corpus')} value={selected.works_count?.toLocaleString()} color="text-blue-600" />
                  <StatCard icon={Star} label={t('pages.institutions.totalCitations', 'Total Citations')} value={selected.cited_by_count?.toLocaleString()} color="text-amber-500" />
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <a
                    href={`https://openalex.org/institutions/${selected.institution_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    <Globe size={13} /> {t('pages.institutions.viewOnOpenAlex', 'View on OpenAlex')}
                  </a>
                  <button
                    onClick={() => window.location.assign(`/authors?institution=${encodeURIComponent(selected.display_name)}`)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-sm text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    <Search size={13} /> {t('pages.institutions.findAuthors', 'Find Authors')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
                {t('pages.institutions.selectPrompt', 'Select an institution to view details')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Featured institutions — shown before any search */}
      {results === null && !loading && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Star size={15} className="text-amber-500" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('pages.institutions.topInstitutions', 'Top institutions')}</h2>
            <span className="text-xs text-slate-400">{t('pages.institutions.topInstitutionsHint', 'most-cited in the corpus — click to explore')}</span>
          </div>
          {featured.length === 0 ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {featured.map((inst) => (
                <button
                  key={inst.institution_id}
                  onClick={() => { setResults([inst]); setSelected(inst); }}
                  className="text-left p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-md hover:border-blue-300 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl shrink-0">{COUNTRY_FLAG(inst.country_code) || '🏛'}</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{inst.display_name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {inst.type && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${TYPE_COLORS[inst.type] ?? TYPE_COLORS.other}`}>
                            {inst.type}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1"><BookOpen size={11} />{(inst.works_count ?? 0).toLocaleString()}</span>
                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"><Star size={11} />{(inst.cited_by_count ?? 0).toLocaleString()}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
