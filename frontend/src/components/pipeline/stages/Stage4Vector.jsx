import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts';

function SimilarityBar({ title, score, rank, delay = 0 }) {
  const pct = Math.min((score ?? 0) * 100, 100);
  return (
    <div className="flex items-center gap-3 text-sm group" title={title}>
      <span className="w-7 shrink-0 text-xs text-purple-500 font-mono font-bold">#{rank}</span>
      <span className="w-32 shrink-0 text-xs text-slate-600 truncate group-hover:text-purple-700 transition-colors">
        {title ?? '…'}
      </span>
      <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden relative">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-purple-400 to-violet-500"
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.75, delay, ease: 'easeOut' }}
        />
        <span className="absolute right-2 top-0 h-full flex items-center text-xs text-slate-500 font-mono font-semibold">
          {pct.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

export default function Stage4Vector({ data }) {
  if (!data) {
    return <div className="text-sm text-slate-400 italic text-center py-8">等待查詢...</div>;
  }

  const { embedding_dim, embedding_sample, model_name, results } = data;

  const chartData = (embedding_sample ?? []).map((v, i) => ({ dim: i, value: v }));
  const posCount = chartData.filter((d) => d.value > 0).length;
  const negCount = chartData.filter((d) => d.value < 0).length;
  const maxAbs = Math.max(...chartData.map((d) => Math.abs(d.value)), 0.001);

  return (
    <div className="space-y-5">
      {/* Explanation */}
      <p className="text-xs text-slate-600 leading-relaxed">
        <strong className="text-slate-700">Sentence-Transformers</strong> 將文字壓縮為固定長度的稠密向量
        （{embedding_dim} 維），使語義相近的句子在向量空間中距離相近。
        搜尋使用<em className="text-purple-700"> 餘弦相似度（Cosine Similarity）</em>，
        找向量夾角最小的論文，能跨越關鍵字差異找到同義或概念相關的內容。
      </p>

      {/* Model + formula row */}
      <div className="flex gap-3">
        <div className="flex-1 rounded-xl border border-purple-200 bg-purple-50 p-3">
          <div className="text-xs font-semibold text-purple-600 mb-1">模型</div>
          <code className="text-xs font-mono text-purple-800 font-semibold">{model_name}</code>
          <p className="text-xs text-slate-500 mt-1">
            384 維 · 512 token 上限 · 多語言支援
          </p>
        </div>
        <div className="flex-1 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
          <div className="text-xs font-semibold text-indigo-600 mb-1">相似度公式</div>
          <div className="font-mono text-xs text-indigo-800">
            cos(A, B) = A·B / (‖A‖‖B‖)
          </div>
          <p className="text-xs text-slate-500 mt-1">
            結果 ∈ [−1, 1]，顯示為 0–100%
          </p>
        </div>
      </div>

      {/* Embedding fingerprint */}
      <div>
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          <span>Query Embedding Fingerprint <span className="font-normal text-slate-400">(前 {chartData.length} 維)</span></span>
          <span className="font-normal normal-case">
            <span className="text-indigo-500 font-medium">{posCount}+</span>
            {' / '}
            <span className="text-red-400 font-medium">{negCount}−</span>
          </span>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="bg-slate-900 rounded-xl p-3"
        >
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={chartData} barCategoryGap={1} margin={{ top: 6, bottom: 4, left: 0, right: 0 }}>
              <Bar dataKey="value" radius={[2, 2, 0, 0]} maxBarSize={12}>
                {chartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.value >= 0 ? '#818cf8' : '#f87171'}
                    fillOpacity={0.75 + (Math.abs(entry.value) / maxAbs) * 0.25}
                  />
                ))}
              </Bar>
              <YAxis hide domain={['auto', 'auto']} />
              <XAxis dataKey="dim" hide />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', fontSize: '11px' }}
                labelStyle={{ color: '#94a3b8' }}
                itemStyle={{ color: '#a5b4fc' }}
                formatter={(v) => [v.toFixed(4), 'value']}
                labelFormatter={(l) => `dim[${l}]`}
              />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-500 text-center mt-1">
            <span className="text-indigo-400">藍色 = 正值</span>
            {' ｜ '}
            <span className="text-red-400">紅色 = 負值</span>
            {' ｜ 顏色深淺 = 絕對值大小（共 '}
            {embedding_dim} 維）
          </p>
        </motion.div>
        <p className="mt-1.5 text-xs text-slate-400">
          每個維度代表一種潛在的語義特徵，人類難以直接解釋，但神經網路可精確捕捉。
          Hover 可看各維度確切數值。
        </p>
      </div>

      {/* Similarity results */}
      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Top-{(results ?? []).length} Cosine Similarity
        </div>
        <div className="space-y-2.5">
          {(results ?? []).map((r, i) => (
            <SimilarityBar
              key={r.work_id}
              title={r.title}
              score={r.vector_score}
              rank={r.rank ?? i + 1}
              delay={i * 0.1}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          向量搜尋可找到語義相關論文（即使用詞不同），是對 BM25 精確匹配的補充。
          兩者的結果將在下一步 RRF Fusion 中合併。
        </p>
      </div>
    </div>
  );
}
