import { motion } from 'framer-motion';

const PAPER_COLORS = [
  { bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-300',    dot: 'bg-blue-500'    },
  { bg: 'bg-rose-100',    text: 'text-rose-700',    border: 'border-rose-300',    dot: 'bg-rose-500'    },
  { bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-300',   dot: 'bg-amber-500'   },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500' },
  { bg: 'bg-purple-100',  text: 'text-purple-700',  border: 'border-purple-300',  dot: 'bg-purple-500'  },
];

function RankColumn({ title, items, colorMap, delay = 0, icon }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.4 }}
      className="flex-1 min-w-0"
    >
      <div className="text-xs font-semibold text-center text-slate-500 uppercase tracking-wider mb-3 flex items-center justify-center gap-1">
        {icon && <span>{icon}</span>}
        {title}
      </div>
      <div className="space-y-2">
        {items.map((item, i) => {
          const color = colorMap[item.work_id] ?? PAPER_COLORS[i % PAPER_COLORS.length];
          return (
            <motion.div
              key={`${item.work_id}-${i}`}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: delay + i * 0.08 }}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border ${color.bg} ${color.border}`}
              title={item.title ?? item.work_id}
            >
              <span className={`text-xs font-bold font-mono ${color.text} shrink-0`}>#{i + 1}</span>
              <div className={`w-2 h-2 rounded-full shrink-0 ${color.dot}`} />
              <span className="text-xs text-slate-700 truncate min-w-0">
                {item.title ? item.title.slice(0, 26) : item.work_id.slice(0, 12)}
              </span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

export default function Stage5Fusion({ bm25Data, vectorData, hybridData }) {
  if (!hybridData) {
    return <div className="text-sm text-slate-400 italic text-center py-8">等待查詢...</div>;
  }

  const bm25   = bm25Data?.results   ?? [];
  const vec    = vectorData?.results  ?? [];
  const hybrid = hybridData.results   ?? [];

  // Stable color assignment per unique work_id
  const allIds = [...new Set([...bm25, ...vec, ...hybrid].map((r) => r.work_id))];
  const colorMap = Object.fromEntries(
    allIds.map((id, i) => [id, PAPER_COLORS[i % PAPER_COLORS.length]])
  );

  // Overlap analysis
  const bm25Ids   = new Set(bm25.map((r) => r.work_id));
  const vecIds    = new Set(vec.map((r) => r.work_id));
  const overlapIds = [...bm25Ids].filter((id) => vecIds.has(id));
  const onlyBm25  = [...bm25Ids].filter((id) => !vecIds.has(id));
  const onlyVec   = [...vecIds].filter((id) => !bm25Ids.has(id));

  return (
    <div className="space-y-5">
      {/* Intro */}
      <p className="text-xs text-slate-600 leading-relaxed">
        <strong className="text-slate-700">Reciprocal Rank Fusion</strong> 將 BM25（精確匹配）和
        向量搜尋（語義相似）的排名列表合併，不需要讓兩種分數在同一尺度上。
        每個文件的最終分數取決於它在各列表中的<em className="text-teal-700"> 排名位置</em>，不是原始分數。
      </p>

      {/* RRF formula */}
      <div className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50 p-4">
        <div className="text-xs font-semibold text-teal-700 uppercase tracking-wider mb-2">RRF 公式</div>
        <div className="font-mono text-sm text-center text-teal-800 font-semibold py-1">
          RRF(d) ={' '}
          <span className="text-slate-600">Σ</span>
          {' '}
          <span className="text-blue-600">1</span>
          {' / ( '}
          <span className="text-amber-600">k</span>
          {' + '}
          <span className="text-purple-600">rank(d)</span>
          {' )'}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
          {[
            ['k = 60', '平滑常數，防止 rank=1 的文件分數過高', 'text-amber-600'],
            ['rank(d)', '文件在該列表的排名位置（從 1 開始）', 'text-purple-600'],
            ['Σ', '對所有搜尋方式（BM25, Vector）求和', 'text-slate-500'],
          ].map(([sym, desc, cls]) => (
            <div key={sym} className="bg-white/60 rounded-lg p-2">
              <div className={`font-mono font-bold ${cls} mb-0.5`}>{sym}</div>
              <div className="text-slate-500 leading-tight">{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 3-column rank comparison */}
      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          排名對比 — <span className="font-normal text-slate-400">相同顏色 = 相同論文</span>
        </div>
        <div className="flex gap-3">
          <RankColumn title="BM25"    items={bm25}   colorMap={colorMap} delay={0.0}  icon="🔤" />
          <RankColumn title="Vector"  items={vec}    colorMap={colorMap} delay={0.15} icon="🧠" />
          <RankColumn title="Hybrid"  items={hybrid} colorMap={colorMap} delay={0.3}  icon="⚡" />
        </div>
      </div>

      {/* Overlap stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: '兩者都有', count: overlapIds.length, color: 'bg-teal-50 border-teal-200 text-teal-700', icon: '🔗' },
          { label: '只有 BM25', count: onlyBm25.length, color: 'bg-blue-50 border-blue-200 text-blue-700', icon: '🔤' },
          { label: '只有 Vector', count: onlyVec.length, color: 'bg-purple-50 border-purple-200 text-purple-700', icon: '🧠' },
        ].map(({ label, count, color, icon }) => (
          <div key={label} className={`rounded-xl border text-center p-2.5 ${color}`}>
            <div className="text-base">{icon}</div>
            <div className="text-lg font-bold">{count}</div>
            <div className="text-xs opacity-70">{label}</div>
          </div>
        ))}
      </div>

      {/* Score table */}
      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Fused Scores
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100">
                <th className="pb-1.5 pr-3 font-medium">Paper</th>
                <th className="pb-1.5 pr-3 font-mono font-medium">BM25</th>
                <th className="pb-1.5 pr-3 font-mono font-medium">Cosine</th>
                <th className="pb-1.5 font-mono font-medium text-teal-600">RRF Score</th>
              </tr>
            </thead>
            <tbody>
              {hybrid.map((r, i) => {
                const c = colorMap[r.work_id] ?? PAPER_COLORS[i % PAPER_COLORS.length];
                return (
                  <tr key={r.work_id} className="border-b border-slate-50 last:border-0">
                    <td className="py-1.5 pr-3">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${c.bg} ${c.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${c.dot} shrink-0`} />
                        {r.work_id.slice(0, 10)}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 font-mono text-blue-600">
                      {r.bm25_score?.toFixed(2) ?? '—'}
                    </td>
                    <td className="py-1.5 pr-3 font-mono text-purple-600">
                      {r.vector_score != null ? (r.vector_score * 100).toFixed(1) + '%' : '—'}
                    </td>
                    <td className="py-1.5 font-mono font-bold text-teal-600">
                      {r.rrf_score?.toFixed(5) ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-1.5 text-xs text-slate-400">
          兩種方式都排名靠前的論文，RRF 分數最高，相當於「多數同意」原則。
        </p>
      </div>
    </div>
  );
}
