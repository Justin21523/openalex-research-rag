import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ExternalLink, ChevronDown, ChevronUp, Sparkles, Loader2, GitBranch } from 'lucide-react';
import { Badge } from './Badge.jsx';
import { api, safeParseJSON } from '../../api/client.js';
import { useT } from '../../i18n/LanguageContext.jsx';

function highlightText(text, query) {
  if (!query || !text) return [{ text, match: false }];
  const tokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  if (!tokens.length) return [{ text, match: false }];
  const pattern = new RegExp(`(${tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return text.split(pattern).map((part) => ({
    text: part,
    match: tokens.some((t) => part.toLowerCase() === t),
  }));
}

function ScoreBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-slate-400 w-14 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-slate-500 w-10 text-right font-mono">{value?.toFixed(4) ?? '—'}</span>
    </div>
  );
}

// ── Inline similar-paper mini-card ────────────────────────────────────────────
function MiniWorkCard({ work }) {
  return (
    <div className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg">
      <div className="text-xs font-medium text-slate-700 line-clamp-2 mb-0.5">
        {work.doi ? (
          <a href={`https://doi.org/${work.doi}`} target="_blank" rel="noreferrer"
             className="text-blue-600 hover:underline">
            {work.title || work.work_id}
          </a>
        ) : (work.title || work.work_id)}
      </div>
      <div className="flex gap-2 text-xs text-slate-400">
        <span className="font-mono">{work.work_id}</span>
        {work.publication_year && <span>· {work.publication_year}</span>}
        {work.vector_score != null && (
          <span>· sim {(work.vector_score * 100).toFixed(1)}%</span>
        )}
      </div>
    </div>
  );
}

export function WorkCard({ work, showScores = false, compact = false, allowSimilar = false, query = '', selectable = false, selected = false, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  const [similarOpen, setSimilarOpen] = useState(false);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [similarWorks, setSimilarWorks] = useState(null);
  const [similarError, setSimilarError] = useState(null);
  const t = useT();

  const concepts = safeParseJSON(work.concepts_json ?? work.concepts, []);
  const topConcepts = concepts.slice(0, 5);

  async function fetchSimilar() {
    if (similarWorks !== null) {
      setSimilarOpen((o) => !o);
      return;
    }
    setSimilarOpen(true);
    setSimilarLoading(true);
    setSimilarError(null);
    try {
      const data = await api.getSimilarWorks(work.work_id, 5);
      setSimilarWorks(data.similar_works ?? []);
    } catch (err) {
      setSimilarError(err.message);
    } finally {
      setSimilarLoading(false);
    }
  }

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-xl border shadow-sm hover:shadow-md transition-shadow p-5 ${
      selected ? 'border-blue-400 ring-1 ring-blue-300' : 'border-slate-200 dark:border-slate-700'
    }`}>
      <div className="flex items-start gap-4">
        {selectable && (
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect?.(work.work_id, e.target.checked)}
            className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 leading-snug mb-1.5 text-sm flex items-start gap-1.5">
            <Link
              to={`/works/${work.work_id}`}
              className="hover:text-blue-600 transition-colors flex-1"
            >
              {work.title || work.work_id}
            </Link>
            {work.doi && (
              <a
                href={`https://doi.org/${work.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-slate-400 hover:text-blue-500 mt-0.5"
                title={t('components.workCard.openDoi')}
              >
                <ExternalLink size={12} />
              </a>
            )}
          </h3>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {work.publication_year && (
              <Badge variant="slate">{work.publication_year}</Badge>
            )}
            {work.cited_by_count != null && (
              <Badge variant="amber">{work.cited_by_count?.toLocaleString()} cited</Badge>
            )}
            {work.journal && (
              <span className="text-xs text-slate-500 truncate max-w-xs">{work.journal}</span>
            )}
            <span className="font-mono text-xs text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
              {work.work_id}
            </span>
          </div>

          {/* Concepts */}
          {topConcepts.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2.5">
              {topConcepts.map((c, i) => (
                <Badge key={i} variant="blue">{c.display_name}</Badge>
              ))}
            </div>
          )}

          {/* Abstract */}
          {!compact && work.abstract && (
            <>
              <p className={`text-sm text-slate-600 dark:text-slate-400 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
                {query
                  ? highlightText(work.abstract, query).map((part, i) =>
                      part.match
                        ? <mark key={i} className="bg-yellow-100 text-yellow-900 rounded-sm px-0.5 not-italic">{part.text}</mark>
                        : <span key={i}>{part.text}</span>
                    )
                  : work.abstract}
              </p>
              <button
                onClick={() => setExpanded((e) => !e)}
                className="text-xs text-blue-600 hover:text-blue-700 mt-1 flex items-center gap-0.5"
              >
                {expanded ? (
                  <><ChevronUp size={12} /> Show less</>
                ) : (
                  <><ChevronDown size={12} /> Show more</>
                )}
              </button>
            </>
          )}
        </div>

        {/* Rank badge */}
        {work.rank && (
          <div className="shrink-0 w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
            {work.rank}
          </div>
        )}
      </div>

      {/* Score breakdown */}
      {showScores && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
          {work.rrf_score != null && (
            <ScoreBar label="RRF" value={work.rrf_score} max={0.05} color="bg-blue-500" />
          )}
          {work.bm25_score != null && (
            <ScoreBar label="BM25" value={work.bm25_score} max={20} color="bg-amber-500" />
          )}
          {work.vector_score != null && (
            <ScoreBar label="Vector" value={work.vector_score} max={1} color="bg-purple-500" />
          )}
        </div>
      )}

      {/* Similar papers toggle */}
      {allowSimilar && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <button
              onClick={fetchSimilar}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-purple-600 transition-colors"
            >
              <Sparkles size={12} />
              {similarOpen ? t('components.workCard.hideSimilar') : t('components.workCard.findSimilar')}
            </button>
            <Link
              to={`/citations?focus=${work.work_id}`}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition-colors"
            >
              <GitBranch size={12} />
              Citations
            </Link>
          </div>

          {similarOpen && (
            <div className="mt-2 space-y-1.5">
              {similarLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                  <Loader2 size={12} className="animate-spin" /> Finding similar papers…
                </div>
              )}
              {similarError && (
                <p className="text-xs text-red-500">{similarError}</p>
              )}
              {similarWorks?.length === 0 && !similarLoading && (
                <p className="text-xs text-slate-400">{t('components.workCard.noSimilar')}</p>
              )}
              {similarWorks?.map((w) => (
                <MiniWorkCard key={w.work_id} work={w} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
