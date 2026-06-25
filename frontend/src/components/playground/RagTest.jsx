import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, BookOpen } from 'lucide-react';
import { api } from '../../api/client';

function WordReveal({ text }) {
  const words = text.split(' ');
  return (
    <p className="text-sm text-slate-700 leading-relaxed">
      {words.map((w, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04, duration: 0.2 }}
          className="inline-block mr-1"
        >
          {w}
        </motion.span>
      ))}
    </p>
  );
}

function CitationChip({ workId }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono
                     bg-amber-100 border border-amber-300 text-amber-800 rounded-full">
      <BookOpen size={10} />
      {workId}
    </span>
  );
}

export default function RagTest() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [error, setError] = useState(null);

  async function runRag(e) {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const data = await api.ragAnswer(query.trim(), { top_k: 5, use_extractive_fallback: true });
      setAnswer(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const citations = answer?.citations ?? [];
  const answerText = answer?.answer ?? '';

  // Extract [Wxxx] refs from answer text
  const refPattern = /\[W\d+\]/g;
  const inlineRefs = answerText.match(refPattern) ?? [];
  const uniqueRefs = [...new Set(inlineRefs)];

  return (
    <div className="space-y-4">
      <form onSubmit={runRag} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="問一個研究問題…"
          className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-xl
                     focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-4 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-xl
                     hover:bg-orange-600 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          <MessageSquare size={14} />
          {loading ? '回答中…' : '詢問'}
        </button>
      </form>

      {error && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{error}</div>
      )}

      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-3 px-4 py-3 bg-orange-50 border border-orange-100 rounded-xl"
        >
          <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-orange-700">正在從論文庫擷取答案…</span>
        </motion.div>
      )}

      <AnimatePresence>
        {answer && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            {/* Answer mode badge */}
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border
                ${answer.mode === 'extractive'
                  ? 'bg-blue-100 border-blue-200 text-blue-700'
                  : 'bg-purple-100 border-purple-200 text-purple-700'}`}
              >
                {answer.mode === 'extractive' ? '📝 Extractive' : '🧠 LLM'}
              </span>
              {answer.latency_ms && (
                <span className="text-xs font-mono text-slate-400">{answer.latency_ms.toFixed(0)} ms</span>
              )}
            </div>

            {/* Answer box */}
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
              <WordReveal text={answerText} />
            </div>

            {/* Citations */}
            {citations.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  引用來源 ({citations.length})
                </div>
                <div className="space-y-2">
                  {citations.slice(0, 5).map((c, i) => (
                    <motion.div
                      key={c.work_id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="flex items-start gap-2.5 px-3 py-2 bg-white border border-slate-100 rounded-lg"
                    >
                      <span className="text-xs font-mono text-amber-600 shrink-0 mt-0.5">[{i + 1}]</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-700 leading-tight line-clamp-2">
                          {c.title || c.work_id}
                        </p>
                        {c.publication_year && (
                          <p className="text-xs text-slate-400 mt-0.5">{c.publication_year}</p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
