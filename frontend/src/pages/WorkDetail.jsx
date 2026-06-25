import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, ExternalLink, BookOpen, GitBranch, FileText, MessageSquare, Sparkles, BookMarked, Check, Loader2, TrendingUp, List } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { api, streamWorkSummary } from '../api/client.js';
import { Badge } from '../components/ui/Badge.jsx';
import { WorkCard } from '../components/ui/WorkCard.jsx';
import { ErrorAlert } from '../components/ui/EmptyState.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';
import { NotesPanel } from '../components/ui/NotesPanel.jsx';
import Markdown from '../components/ui/Markdown.jsx';
import { useT } from '../i18n/LanguageContext.jsx';

export default function WorkDetail() {
  const t = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const [work, setWork] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contexts, setContexts] = useState([]);
  const [showContexts, setShowContexts] = useState(false);

  // AI Summary
  const [summaryText, setSummaryText] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // Reading List
  const [rlStatus, setRlStatus] = useState(null); // null = not in list
  const [rlLoading, setRlLoading] = useState(false);

  // Citation trend + references
  const [citationTrend, setCitationTrend] = useState(null);
  const [references, setReferences] = useState(null);
  const [showRefs, setShowRefs] = useState(false);

  useEffect(() => {
    api.getReadingStatus(id)
      .then((d) => setRlStatus(d.status ?? null))
      .catch(() => setRlStatus(null));
    api.getCitationTrend(id)
      .then(setCitationTrend)
      .catch(() => setCitationTrend([]));
  }, [id]);

  const loadReferences = async () => {
    if (references !== null) { setShowRefs((s) => !s); return; }
    try {
      const data = await api.getCitations(id, 'out', 30);
      setReferences(data.cited ?? []);
      setShowRefs(true);
    } catch {
      setReferences([]);
    }
  };

  const generateSummary = async () => {
    setShowSummary(true);
    if (summaryText) return; // already generated
    setSummaryLoading(true);
    setSummaryText('');
    try {
      for await (const event of streamWorkSummary(id)) {
        if (event.type === 'token') setSummaryText((p) => p + event.content);
        else if (event.type === 'done') setSummaryText((p) => p || event.answer_text || '');
      }
    } catch (e) {
      setSummaryText(`Error: ${e.message}`);
    } finally {
      setSummaryLoading(false);
    }
  };

  const toggleReadingList = async () => {
    setRlLoading(true);
    try {
      if (rlStatus === null) {
        await api.addToReadingList(id);
        setRlStatus('unread');
      } else {
        await api.removeFromReadingList(id);
        setRlStatus(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRlLoading(false);
    }
  };

  const updateRlStatus = async (status) => {
    await api.updateReadingStatus(id, status);
    setRlStatus(status);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      api.getWork(id),
      api.getSimilarWorks(id, 5).catch(() => ({ results: [] })),
    ])
      .then(([w, sim]) => {
        if (cancelled) return;
        setWork(w);
        setSimilar(sim.results ?? []);
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) return <ErrorAlert message={error} />;
  if (!work) return null;

  const concepts = (work.concepts ?? []).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const authors = work.authors ?? [];

  return (
    <div className="max-w-3xl mx-auto pb-12">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-4 transition-colors"
      >
        <ChevronLeft size={16} /> {t('pages.workDetail.back', 'Back')}
      </button>

      {/* Title + DOI */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight mb-2">
          {work.title || work.work_id}
        </h1>
        <div className="flex items-center gap-3 flex-wrap">
          {work.doi && (
            <a
              href={`https://doi.org/${work.doi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
            >
              <ExternalLink size={12} />
              {work.doi}
            </a>
          )}
          {work.work_id && (
            <span className="font-mono text-xs text-slate-400">{work.work_id}</span>
          )}
        </div>
      </div>

      {/* Meta badges */}
      <div className="flex flex-wrap gap-2 mb-5">
        {work.publication_year && <Badge variant="slate">{work.publication_year}</Badge>}
        {work.cited_by_count != null && (
          <Badge variant="amber">{work.cited_by_count.toLocaleString()} citations</Badge>
        )}
        {work.journal && <Badge variant="blue">{work.journal}</Badge>}
        {work.language && <Badge variant="slate">{work.language.toUpperCase()}</Badge>}
        {work.type && <Badge variant="green">{work.type}</Badge>}
      </div>

      {/* Abstract */}
      {work.abstract && (
        <div className="mb-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">{t('pages.workDetail.abstract', 'Abstract')}</h2>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{work.abstract}</p>
        </div>
      )}

      {/* Concepts */}
      {concepts.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">{t('pages.workDetail.concepts', 'Concepts')}</h2>
          <div className="flex flex-wrap gap-1.5">
            {concepts.map((c, i) => (
              <span
                key={i}
                className="px-2.5 py-1 rounded-full text-xs font-medium"
                style={{
                  background: `hsla(${200 + i * 25}, 70%, 92%, 1)`,
                  color: `hsla(${200 + i * 25}, 60%, 30%, 1)`,
                }}
              >
                {c.display_name ?? c.name}
                {c.score != null && (
                  <span className="ml-1 opacity-60">{(c.score * 100).toFixed(0)}%</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Authors */}
      {authors.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">{t('pages.workDetail.authors', 'Authors')}</h2>
          <div className="flex flex-wrap gap-2">
            {authors.map((a, i) => {
              const name = typeof a === 'string'
                ? a
                : (a.author?.display_name ?? a.raw_author_name ?? a.display_name ?? a.name ?? t('pages.workDetail.unknown', 'Unknown'));
              return (
                <span key={i} className="text-sm text-slate-700 dark:text-slate-300">
                  {name}
                  {i < authors.length - 1 && <span className="text-slate-300 ml-2">·</span>}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* AI Summary */}
        <button
          onClick={generateSummary}
          disabled={summaryLoading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-blue-200
                     bg-blue-50 hover:bg-blue-100 text-sm text-blue-700 transition-colors disabled:opacity-50"
        >
          {summaryLoading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {t('pages.workDetail.aiSummary', 'AI Summary')}
        </button>

        {/* Reading List */}
        <div className="flex items-center gap-1">
          <button
            onClick={toggleReadingList}
            disabled={rlLoading}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm transition-colors disabled:opacity-50 ${
              rlStatus !== null
                ? 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                : 'border-slate-200 hover:bg-slate-50 text-slate-600'
            }`}
          >
            {rlLoading ? <Loader2 size={15} className="animate-spin" /> : rlStatus !== null ? <Check size={15} /> : <BookMarked size={15} />}
            {rlStatus !== null ? t('pages.workDetail.inReadingList', 'In Reading List') : t('pages.workDetail.addToReadingList', 'Add to Reading List')}
          </button>
          {rlStatus !== null && (
            <select
              value={rlStatus}
              onChange={(e) => updateRlStatus(e.target.value)}
              className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="unread">{t('pages.workDetail.statusUnread', 'Unread')}</option>
              <option value="reading">{t('pages.workDetail.statusReading', 'Reading')}</option>
              <option value="done">{t('pages.workDetail.statusDone', 'Done')}</option>
            </select>
          )}
        </div>

        <Link
          to={`/citations?focus=${work.work_id}`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200
                     hover:bg-slate-50 text-sm text-slate-600 transition-colors"
        >
          <GitBranch size={15} />
          {t('pages.workDetail.citationGraph', 'Citation Graph')}
        </Link>
        <button
          onClick={() => {
            if (!showContexts) {
              api.getCitationContexts(work.work_id).then((d) => setContexts(d.contexts ?? []));
            }
            setShowContexts((s) => !s);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200
                     hover:bg-slate-50 text-sm text-slate-600 transition-colors"
        >
          <MessageSquare size={15} />
          {t('pages.workDetail.citationContexts', 'Citation Contexts')}
          {contexts.length > 0 && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 rounded-full">{contexts.length}</span>}
        </button>
      </div>

      {/* AI Summary Panel */}
      {showSummary && (
        <div className="mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-100 dark:border-blue-900 rounded-2xl p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-blue-500 mb-3 flex items-center gap-2">
            <Sparkles size={13} />
            {t('pages.workDetail.aiSummary', 'AI Summary')}
          </h2>
          {summaryText ? (
            <Markdown text={summaryText} streaming={summaryLoading} />
          ) : summaryLoading ? (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <Loader2 size={14} className="animate-spin" /> {t('pages.workDetail.generating', 'Generating…')}
            </div>
          ) : null}
        </div>
      )}

      {/* Citation contexts panel */}
      {showContexts && (
        <div className="mb-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            {t('pages.workDetail.papersCitingThisWork', 'Papers citing this work (with context)')}
          </h2>
          {contexts.length === 0 ? (
            <p className="text-sm text-slate-400">{t('pages.workDetail.noContextsBefore', 'No citation contexts fetched yet. Run')} <code className="font-mono text-xs bg-slate-100 px-1 rounded">scripts/fetch_citation_contexts.py</code> {t('pages.workDetail.noContextsAfter', 'to collect them.')}</p>
          ) : (
            <div className="space-y-3">
              {contexts.map((ctx, i) => (
                <div key={i} className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-xs font-medium text-slate-700 mb-1">
                    {ctx.citing_title || ctx.citing_work_id}
                    {ctx.citing_year && <span className="ml-2 text-slate-400">({ctx.citing_year})</span>}
                    {ctx.intent && <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{ctx.intent}</span>}
                  </p>
                  <p className="text-sm text-slate-600 italic">"{ctx.context_text}"</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-slate-100 dark:border-slate-700 mb-6" />

      {/* Citation Trend Chart */}
      {citationTrend !== null && (
        <div className="mb-6 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
            <TrendingUp size={15} className="text-blue-500" />
            {t('pages.workDetail.citationTrend', 'Citation Trend')}
          </h2>
          {citationTrend.length === 0 ? (
            <p className="text-sm text-slate-400">{t('pages.workDetail.notCitedYet', 'Not cited yet in our database.')}</p>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={citationTrend} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="citGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(v) => [v, t('pages.workDetail.citationsLabel', 'Citations')]}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#citGrad)"
                  dot={{ r: 3, fill: '#3b82f6' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* References (papers this work cites) */}
      <div className="mb-6 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-5">
        <button
          onClick={loadReferences}
          className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200 w-full text-left"
        >
          <List size={15} className="text-slate-500" />
          {t('pages.workDetail.references', 'References')}
          {references !== null && <Badge variant="slate">{references.length}</Badge>}
          <span className="ml-auto text-xs text-blue-500 font-normal">
            {showRefs ? t('pages.workDetail.hide', 'Hide') : t('pages.workDetail.show', 'Show')}
          </span>
        </button>
        {showRefs && references !== null && (
          <div className="mt-3 space-y-1.5">
            {references.length === 0 ? (
              <p className="text-sm text-slate-400">{t('pages.workDetail.noReferences', 'No references found in database.')}</p>
            ) : (
              references.map((ref) => (
                <div
                  key={ref.work_id}
                  className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors"
                  onClick={() => navigate(`/works/${ref.work_id}`)}
                >
                  <span className="text-xs text-slate-400 mt-0.5 w-10 shrink-0">
                    {ref.publication_year ?? '—'}
                  </span>
                  <span className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2 flex-1">
                    {ref.title || ref.work_id}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="mb-8 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl p-5">
        <NotesPanel workId={work.work_id} />
      </div>

      {/* Similar works */}
      {similar.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
            <BookOpen size={15} />
            {t('pages.workDetail.similarWorks', 'Similar Works')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {similar.map((w) => (
              <WorkCard key={w.work_id} work={w} compact />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
