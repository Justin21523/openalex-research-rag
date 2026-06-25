import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts';
import { api } from '../../api/client';

const MODE_COLORS = { bm25: '#f59e0b', vector: '#a855f7', hybrid: '#14b8a6', fts: '#3b82f6' };

function StatCard({ label, value, sub, color = 'slate' }) {
  const ring = {
    slate: 'border-slate-200 bg-white', emerald: 'border-emerald-200 bg-emerald-50',
    amber: 'border-amber-200 bg-amber-50', purple: 'border-purple-200 bg-purple-50',
  };
  return (
    <div className={`rounded-xl border p-4 ${ring[color]}`}>
      <div className="text-lg font-bold text-slate-700">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

function LatencyRow({ mode, data }) {
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50">
      <td className="py-2.5 px-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: MODE_COLORS[mode] ?? '#94a3b8' }} />
          {mode.toUpperCase()}
        </span>
      </td>
      <td className="py-2.5 px-3 text-right font-mono text-sm text-slate-600">{data.latency_p50_ms.toFixed(1)}</td>
      <td className="py-2.5 px-3 text-right font-mono text-sm text-slate-600">{data.latency_p99_ms.toFixed(1)}</td>
      <td className="py-2.5 px-3 text-right font-mono text-sm text-slate-600">{data.latency_mean_ms.toFixed(1)}</td>
      <td className="py-2.5 px-3 text-right text-sm text-slate-600">{data.avg_result_count.toFixed(1)}</td>
    </tr>
  );
}

function LatencyChart({ modes }) {
  const data = Object.entries(modes).map(([mode, m]) => ({
    mode: mode.toUpperCase(),
    'P50 (ms)': +m.latency_p50_ms.toFixed(1),
    'P99 (ms)': +m.latency_p99_ms.toFixed(1),
    'Mean (ms)': +m.latency_mean_ms.toFixed(1),
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} barGap={4} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="mode" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} unit=" ms" width={55} />
        <Tooltip formatter={(v) => `${v} ms`} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="P50 (ms)" fill="#14b8a6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="P99 (ms)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Mean (ms)" fill="#a855f7" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Recommendation({ modes }) {
  const entries = Object.entries(modes);
  const fastest = entries.sort((a, b) => a[1].latency_mean_ms - b[1].latency_mean_ms)[0];
  const hasHybrid = 'hybrid' in modes;
  const hasVector = 'vector' in modes;

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
      <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">自動建議</p>
      <ul className="space-y-1.5 text-xs text-emerald-800">
        <li>• <strong>{fastest[0].toUpperCase()}</strong> 平均延遲最低（{fastest[1].latency_mean_ms.toFixed(1)} ms），適合低延遲場景</li>
        {hasHybrid && (
          <li>• <strong>HYBRID</strong> 結合語義與關鍵字，推薦作為預設搜尋模式</li>
        )}
        {hasVector && !hasHybrid && (
          <li>• <strong>VECTOR</strong> 提供語義搜尋能力，建議配合 BM25 組成 Hybrid</li>
        )}
        {!hasVector && (
          <li>• 建議完成向量嵌入步驟（Step 4）以啟用語義搜尋模式</li>
        )}
      </ul>
    </div>
  );
}

export default function EvalDashboard({ stats, onEvaluate }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function runEval() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.playgroundEvaluate();
      setResult(data);
      onEvaluate?.(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Corpus stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="總論文數" value={stats.corpus_total?.toLocaleString()} color="slate" />
          <StatCard label="用戶上傳" value={stats.user_uploaded?.toLocaleString()} color="amber" />
          <StatCard
            label="BM25 詞彙量"
            value={stats.bm25_vocab_size?.toLocaleString()}
            sub={`${stats.bm25_doc_count} docs indexed`}
            color="emerald"
          />
          <StatCard
            label="向量數量"
            value={stats.vector_count?.toLocaleString()}
            sub={stats.vector_count === 0 ? '尚未建立嵌入' : '已建立'}
            color="purple"
          />
        </div>
      )}

      {/* Run button */}
      <button
        onClick={runEval}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-3
                   bg-emerald-600 text-white text-sm font-semibold rounded-xl
                   hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            評估中（約 10–30 秒）…
          </>
        ) : '▸ 執行評估'}
      </button>

      {error && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{error}</div>
      )}

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Summary row */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-base font-bold text-slate-700">{result.corpus_total?.toLocaleString()}</div>
                <div className="text-xs text-slate-400">語料庫論文數</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-base font-bold text-slate-700">{result.queries_run}</div>
                <div className="text-xs text-slate-400">測試查詢數</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-base font-bold text-slate-700">{Object.keys(result.modes).length}</div>
                <div className="text-xs text-slate-400">評估模式</div>
              </div>
            </div>

            {/* Latency table */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 text-left text-xs font-semibold text-slate-500 uppercase">模式</th>
                    <th className="py-2 px-3 text-right text-xs font-semibold text-slate-500 uppercase">P50</th>
                    <th className="py-2 px-3 text-right text-xs font-semibold text-slate-500 uppercase">P99</th>
                    <th className="py-2 px-3 text-right text-xs font-semibold text-slate-500 uppercase">Mean</th>
                    <th className="py-2 px-3 text-right text-xs font-semibold text-slate-500 uppercase">Avg. Hits</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(result.modes).map(([mode, data]) => (
                    <LatencyRow key={mode} mode={mode} data={data} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Chart */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">延遲分布圖</p>
              <LatencyChart modes={result.modes} />
            </div>

            {/* Test queries */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">測試查詢</p>
              <div className="flex flex-wrap gap-1.5">
                {result.test_queries?.map((q, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-full border border-slate-200 bg-white text-xs text-slate-600"
                  >
                    {q}
                  </span>
                ))}
              </div>
            </div>

            {/* Recommendation */}
            <Recommendation modes={result.modes} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
