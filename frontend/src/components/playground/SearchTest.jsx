import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { api } from '../../api/client';

const MODES = ['hybrid', 'bm25', 'vector', 'fts'];
const MODE_COLORS = {
  hybrid: 'bg-teal-100 text-teal-700 border-teal-300',
  bm25:   'bg-amber-100 text-amber-700 border-amber-300',
  vector: 'bg-purple-100 text-purple-700 border-purple-300',
  fts:    'bg-blue-100 text-blue-700 border-blue-300',
};

function ScoreBar({ label, value, color, delay = 0 }) {
  const pct = Math.min((value ?? 0) * 100, 100);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-12 shrink-0 text-slate-400">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, delay, ease: 'easeOut' }}
        />
      </div>
      <span className="w-10 text-right font-mono text-slate-500">
        {value != null ? (value > 1 ? value.toFixed(2) : (value * 100).toFixed(1) + '%') : '—'}
      </span>
    </div>
  );
}

export default function SearchTest() {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('hybrid');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [latency, setLatency] = useState(null);

  async function runSearch(e) {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.search(query.trim(), { mode, k: 8 });
      setResults(data.results ?? []);
      setLatency(data.latency_ms);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <div className="flex gap-2 flex-wrap">
        {MODES.map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors
              ${mode === m ? MODE_COLORS[m] : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Query input */}
      <form onSubmit={runSearch} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="輸入搜尋關鍵字…"
          className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-xl
                     focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-4 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-xl
                     hover:bg-teal-700 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          <Search size={14} />
          {loading ? '搜尋中…' : '搜尋'}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{error}</div>
      )}

      {/* Results */}
      {results && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {results.length} 筆結果
            </span>
            <span className="text-xs font-mono text-slate-400">{latency?.toFixed(1)} ms</span>
          </div>
          <div className="space-y-2">
            {results.map((r, i) => (
              <motion.div
                key={r.work_id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-3 bg-white border border-slate-100 rounded-xl hover:border-slate-200 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs font-mono text-teal-600">{r.work_id}</span>
                  <span className="text-xs text-slate-400 shrink-0">#{r.rank}</span>
                </div>
                <p className="text-sm text-slate-700 font-medium leading-tight line-clamp-2 mb-2">
                  {r.title || '(no title)'}
                </p>
                <div className="space-y-1">
                  {r.bm25_score != null && (
                    <ScoreBar label="BM25" value={r.bm25_score} color="bg-amber-400" delay={i * 0.05} />
                  )}
                  {r.vector_score != null && (
                    <ScoreBar label="Vector" value={r.vector_score} color="bg-purple-400" delay={i * 0.05 + 0.05} />
                  )}
                  {r.rrf_score != null && (
                    <ScoreBar label="RRF" value={r.rrf_score * 1000} color="bg-teal-400" delay={i * 0.05 + 0.1} />
                  )}
                </div>
              </motion.div>
            ))}
          </div>
          {results.length === 0 && (
            <div className="text-center py-6 text-sm text-slate-400 italic">無搜尋結果</div>
          )}
        </div>
      )}
    </div>
  );
}
