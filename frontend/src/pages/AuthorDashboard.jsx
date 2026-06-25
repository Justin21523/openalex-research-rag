import { useState, useEffect } from 'react';
import { Search, User, Building2, BookOpen, Star, Network, Loader2 } from 'lucide-react';
import { CoauthorNetwork } from '../components/charts/CoauthorNetwork.jsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '../api/client.js';
import { Badge } from '../components/ui/Badge.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';
import { EmptyState, ErrorAlert } from '../components/ui/EmptyState.jsx';
import { WorkCard } from '../components/ui/WorkCard.jsx';
import Combobox from '../components/ui/Combobox.jsx';
import { useT } from '../i18n/LanguageContext.jsx';

const DETAIL_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'coauthors', label: 'Co-Author Network' },
];

function StatCard({ icon: Icon, label, value, color = 'text-blue-600' }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className={color} />
        <span className="text-xs text-slate-500 font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value ?? '—'}</p>
    </div>
  );
}

export default function AuthorDashboard() {
  const t = useT();
  const [q, setQ] = useState('');
  const [authors, setAuthors] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(null);
  const [detailTab, setDetailTab] = useState('overview');
  const [coauthors, setCoauthors] = useState(null);
  const [coLoading, setCoLoading] = useState(false);
  const [featured, setFeatured] = useState([]);
  const [previewNetwork, setPreviewNetwork] = useState(null);

  useEffect(() => {
    api.getTopAuthors(12).then((res) => setFeatured(Array.isArray(res) ? res : [])).catch(() => {});
  }, []);

  useEffect(() => {
    const first = featured[0];
    if (!first || previewNetwork) return;
    api.getCoauthors(first.author_id, 24)
      .then((res) => setPreviewNetwork({ author: first, graph: res }))
      .catch(() => setPreviewNetwork({ author: first, graph: { nodes: [], edges: [] } }));
  }, [featured, previewNetwork]);

  const asList = (res) => (Array.isArray(res) ? res : (res?.results ?? []));

  const searchAuthors = async (query = q) => {
    if (!query.trim()) return;
    setQ(query);
    setLoading(true);
    setError(null);
    setSelected(null);
    setDetail(null);
    try {
      const res = await api.searchAuthors(query);
      setAuthors(asList(res));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const selectAuthor = async (author) => {
    setSelected(author);
    setDetail(null);
    setCoauthors(null);
    setDetailTab('overview');
    setDetailLoading(true);
    try {
      const res = await api.getAuthor(author.author_id);
      setDetail(res);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const loadCoauthors = async (authorId) => {
    if (coauthors) return;
    setCoLoading(true);
    try {
      const res = await api.getCoauthors(authorId, 20);
      setCoauthors(res);
    } catch {
      setCoauthors({ nodes: [], edges: [] });
    } finally {
      setCoLoading(false);
    }
  };

  useEffect(() => {
    if (detailTab === 'coauthors' && selected && !coauthors) {
      loadCoauthors(selected.author_id);
    }
  }, [detailTab, selected]);

  const pubsByYear = detail?.works
    ? Object.entries(
        detail.works.reduce((acc, w) => {
          const y = w.publication_year;
          if (y) acc[y] = (acc[y] ?? 0) + 1;
          return acc;
        }, {})
      )
        .sort(([a], [b]) => +a - +b)
        .map(([year, count]) => ({ year: +year, count }))
    : [];

  return (
    <div className="max-w-5xl mx-auto">
      <div data-tour="authors" className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">{t('pages.authors.title', 'Author Dashboard')}</h1>
        <p className="text-slate-500 text-sm">{t('pages.authors.subtitle', 'Search authors in the corpus — view publication history and affiliations')}</p>
      </div>

      {/* Search — combobox with top-author presets */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4">
        <Combobox
          placeholder={t('pages.authors.searchPlaceholder', 'Pick a top author or type a name…')}
          topLabel={t('pages.authors.mostCitedAuthors', 'Most-cited authors')}
          fetchTop={() => api.getTopAuthors(20)}
          fetchSearch={(query) => api.searchAuthors(query).then(asList)}
          getKey={(a) => a.author_id}
          renderOption={(a) => (
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{a.display_name}</p>
              <p className="text-xs text-slate-400 truncate">
                {a.institution_name ? `${a.institution_name} · ` : ''}
                {(a.cited_by_count ?? 0).toLocaleString()} {t('pages.authors.citations', 'citations')}
              </p>
            </div>
          )}
          onSelect={(a) => { setAuthors([a]); selectAuthor(a); }}
          onSubmit={(text) => searchAuthors(text)}
        />
      </div>

      {error && <ErrorAlert message={error} />}

      {/* Results + detail layout */}
      {authors !== null && (
        <div className="flex gap-4">
          {/* Author list */}
          <div className="w-72 shrink-0">
            {authors.length === 0 ? (
              <EmptyState icon={User} title={t('pages.authors.noAuthorsFound', 'No authors found')} description={t('pages.authors.tryDifferentName', 'Try a different name.')} />
            ) : (
              <div className="space-y-2">
                {authors.map((a) => (
                  <button
                    key={a.author_id}
                    onClick={() => selectAuthor(a)}
                    className={`w-full text-left p-3 rounded-xl border transition-colors ${
                      selected?.author_id === a.author_id
                        ? 'bg-blue-50 border-blue-300 text-blue-900'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <p className="font-medium text-sm truncate">{a.display_name}</p>
                    {a.institution_name && (
                      <p className="text-xs text-slate-500 truncate mt-0.5">{a.institution_name}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">{a.author_id}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Author detail */}
          <div className="flex-1 min-w-0">
            {detailLoading && (
              <div className="flex justify-center py-16"><Spinner size="lg" /></div>
            )}
            {!detailLoading && detail && (
              <div className="space-y-4">
                {/* Detail tabs */}
                <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
                  {DETAIL_TABS.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setDetailTab(key)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        detailTab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {key === 'overview'
                        ? t('pages.authors.tabOverview', 'Overview')
                        : t('pages.authors.tabCoauthors', 'Co-Author Network')}
                    </button>
                  ))}
                </div>

                {/* Profile card — always visible */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shrink-0">
                      {(detail.display_name || 'A')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-slate-900 truncate">{detail.display_name}</h2>
                      {detail.institution_name && (
                        <div className="flex items-center gap-1.5 text-slate-500 text-sm mt-0.5">
                          <Building2 size={13} />
                          <span className="truncate">{detail.institution_name}</span>
                        </div>
                      )}
                      <p className="font-mono text-xs text-slate-400 mt-1">{detail.author_id}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <StatCard icon={BookOpen} label={t('pages.authors.works', 'Works')} value={detail.works_count?.toLocaleString()} color="text-blue-600" />
                    <StatCard icon={Star} label={t('pages.authors.citationsStat', 'Citations')} value={detail.cited_by_count?.toLocaleString()} color="text-amber-500" />
                    <StatCard icon={User} label="h-index" value={detail.h_index} color="text-purple-600" />
                  </div>
                </div>

                {/* Overview tab */}
                {detailTab === 'overview' && (
                  <>
                    {/* Publications by year */}
                    {pubsByYear.length > 0 && (
                      <div className="bg-white rounded-2xl border border-slate-200 p-5">
                        <h3 className="font-semibold text-slate-900 mb-4">{t('pages.authors.publicationsByYear', 'Publications by Year')}</h3>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={pubsByYear} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                            <Tooltip
                              contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: '#f1f5f9', fontSize: '12px' }}
                            />
                            <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Top 5 most-cited works */}
                    {(detail.all_works ?? detail.works ?? []).length > 0 && (
                      <div className="bg-white rounded-2xl border border-slate-200 p-5">
                        <h3 className="font-semibold text-slate-900 mb-3">{t('pages.authors.topCitedWorks', 'Top Cited Works')}</h3>
                        <div className="space-y-2.5">
                          {(detail.all_works ?? detail.works ?? [])
                            .slice(0, 5)
                            .map((w, i) => (
                              <div key={w.work_id} className="flex items-start gap-3">
                                <span className="text-xs text-slate-400 font-mono w-5 pt-0.5 shrink-0">{i + 1}</span>
                                <div className="flex-1 min-w-0">
                                  <button
                                    onClick={() => window.location.assign(`/works/${w.work_id}`)}
                                    className="text-sm text-blue-700 hover:underline text-left line-clamp-2 font-medium"
                                  >
                                    {w.title || w.work_id}
                                  </button>
                                  <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                                    {w.publication_year && <span>{w.publication_year}</span>}
                                    {w.cited_by_count > 0 && (
                                      <span className="text-amber-600 font-semibold">{w.cited_by_count.toLocaleString()} {t('pages.authors.citations', 'citations')}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Recent works */}
                    {detail.recent_works?.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-slate-900 mb-3">{t('pages.authors.recentWorks', 'Recent Works')}</h3>
                        <div className="space-y-3">
                          {detail.recent_works.slice(0, 5).map((w) => (
                            <WorkCard key={w.work_id} work={w} compact />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Co-author network tab */}
                {detailTab === 'coauthors' && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                      <Network size={15} /> {t('pages.authors.coAuthorNetwork', 'Co-Author Network')}
                    </h3>
                    {coLoading ? (
                      <div className="flex justify-center py-12"><Spinner /></div>
                    ) : (
                      <CoauthorNetwork
                        centerName={detail.display_name}
                        nodes={coauthors?.nodes ?? []}
                        edges={coauthors?.edges ?? []}
                        onNodeClick={(authorId, name) => {
                          // Navigate to author search by name
                          setQ(name);
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
            {!detailLoading && selected && !detail && (
              <EmptyState icon={User} title={t('pages.authors.couldNotLoad', 'Could not load author details')} />
            )}
          </div>
        </div>
      )}

      {/* Featured authors — shown before any search */}
      {authors === null && !loading && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Star size={15} className="text-amber-500" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('pages.authors.featuredAuthors', 'Featured authors')}</h2>
            <span className="text-xs text-slate-400">{t('pages.authors.featuredHint', 'most-cited in the corpus — click to explore')}</span>
          </div>
          {featured.length === 0 ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {featured.map((a) => (
                <button
                  key={a.author_id}
                  onClick={() => { setAuthors([a]); selectAuthor(a); }}
                  className="text-left p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-md hover:border-blue-300 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shrink-0">
                      {(a.display_name || 'A')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{a.display_name}</p>
                      {a.institution_name && (
                        <p className="text-xs text-slate-500 truncate">{a.institution_name}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1"><BookOpen size={11} />{(a.works_count ?? 0).toLocaleString()}</span>
                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"><Star size={11} />{(a.cited_by_count ?? 0).toLocaleString()}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
          {previewNetwork && (
            <div className="mt-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                <Network size={15} /> {t('pages.authors.networkPreviewTitle', 'Collaboration network preview')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                {t('pages.authors.networkPreviewDesc', 'A live co-author graph for a top author in the corpus. Click any author card above to inspect their own network.')}
              </p>
              <CoauthorNetwork
                centerName={previewNetwork.author.display_name}
                nodes={previewNetwork.graph?.nodes ?? []}
                edges={previewNetwork.graph?.edges ?? []}
                onNodeClick={(_, name) => searchAuthors(name)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
