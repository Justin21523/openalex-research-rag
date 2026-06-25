import { motion } from 'framer-motion';

function AnimatedBar({ value, max, label, delay = 0, title: fullTitle }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm group" title={fullTitle}>
      <span className="w-36 shrink-0 text-xs text-slate-600 truncate group-hover:text-amber-700 transition-colors">
        {label}
      </span>
      <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden relative">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500"
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.75, delay, ease: 'easeOut' }}
        />
        <span className="absolute right-2 top-0 h-full flex items-center text-xs text-slate-500 font-mono font-semibold">
          {value?.toFixed(2) ?? '—'}
        </span>
      </div>
    </div>
  );
}

const chipVariants = {
  hidden: { opacity: 0, y: 14, scale: 0.85 },
  show: (i) => ({ opacity: 1, y: 0, scale: 1, transition: { delay: i * 0.08, duration: 0.3 } }),
};

export default function Stage3BM25({ data }) {
  if (!data) {
    return <div className="text-sm text-slate-400 italic text-center py-8">等待查詢...</div>;
  }

  const { query_tokens, token_info, corpus_size, results } = data;
  const maxBm25 = Math.max(...(results ?? []).map((r) => r.bm25_score ?? 0), 0.01);
  const avgIdf = token_info.length
    ? (token_info.reduce((s, t) => s + (t.idf_score ?? 0), 0) / token_info.length).toFixed(2)
    : '—';

  return (
    <div className="space-y-5">
      {/* Intro */}
      <p className="text-xs text-slate-600 leading-relaxed">
        <strong className="text-slate-700">BM25Okapi</strong>（Best Match 25）是一種基於
        <em className="text-amber-700"> 詞頻 TF</em> 和
        <em className="text-amber-700"> 逆文件頻率 IDF</em> 的稀疏關鍵字搜尋算法。
        它對長文件有平滑補正（k₁ = 1.5, b = 0.75），是搜尋引擎的基礎算法。
      </p>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Corpus 大小', value: corpus_size?.toLocaleString() ?? '—', sub: '篇論文', bg: 'bg-amber-50 border-amber-200 text-amber-700' },
          { label: 'Query Tokens', value: query_tokens.length, sub: '個詞彙', bg: 'bg-slate-50 border-slate-200 text-slate-600' },
          { label: '平均 IDF', value: avgIdf, sub: 'of query terms', bg: 'bg-orange-50 border-orange-200 text-orange-700' },
        ].map(({ label, value, sub, bg }) => (
          <div key={label} className={`rounded-xl border p-3 text-center ${bg}`}>
            <div className="text-lg font-bold font-mono">{value}</div>
            <div className="text-xs opacity-60">{label}</div>
            <div className="text-xs opacity-50">{sub}</div>
          </div>
        ))}
      </div>

      {/* BM25 formula */}
      <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4">
        <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">BM25 公式</div>
        <div className="font-mono text-xs text-slate-700 leading-loose">
          <div>
            score(d, q) = Σᵢ{' '}
            <span className="text-purple-600 font-semibold">IDF(qᵢ)</span>
            {' · '}
            <span className="text-blue-600 font-semibold">f(qᵢ, d)</span>
            {' · (k₁ + 1) / ('}
            <span className="text-blue-600">f(qᵢ, d)</span>
            {' + k₁ · (1 − b + b · '}
            <span className="text-emerald-600">|d|</span>
            {' / avgdl))'}
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
          {[
            ['IDF(qᵢ)', '逆文件頻率 — 詞彙在語料中越稀少 → 分數越高', 'text-purple-600'],
            ['f(qᵢ, d)', '詞彙在文件中出現次數（TF）', 'text-blue-600'],
            ['|d|', '文件長度（詞數）', 'text-emerald-600'],
            ['k₁=1.5, b=0.75', '飽和參數（超參數，通常固定）', 'text-slate-500'],
          ].map(([sym, desc, cls]) => (
            <div key={sym} className="flex gap-1.5 items-start">
              <span className={`font-mono font-bold shrink-0 ${cls}`}>{sym}</span>
              <span className="text-slate-500 leading-tight">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Token chips with IDF scores */}
      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Query Tokens + IDF Scores
        </div>
        <div className="flex flex-wrap gap-2">
          {(token_info ?? []).map((t, i) => {
            const hue = Math.min(t.idf_score * 12, 100);
            return (
              <motion.div
                key={i}
                custom={i}
                variants={chipVariants}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl shadow-sm"
              >
                <span className="font-mono text-sm text-amber-800 font-semibold">{t.token}</span>
                <span className="text-xs text-amber-500 font-mono bg-amber-100 px-1.5 py-0.5 rounded">
                  idf={t.idf_score?.toFixed(2) ?? '—'}
                </span>
                {/* Mini IDF intensity bar */}
                <div className="w-8 h-1.5 bg-amber-200 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-amber-500 rounded-full"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${Math.min(hue, 100)}%` }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 + 0.3, duration: 0.4 }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-slate-400">
          IDF 越高 → 該詞在語料中越罕見 → 命中時貢獻的 BM25 分數越大。
        </p>
      </div>

      {/* BM25 result bars */}
      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Top-{(results ?? []).length} BM25 Results
        </div>
        <div className="space-y-2.5">
          {(results ?? []).map((r, i) => (
            <AnimatedBar
              key={r.work_id}
              label={r.title ? r.title.slice(0, 38) : r.work_id}
              fullTitle={r.title ?? r.work_id}
              value={r.bm25_score ?? 0}
              max={maxBm25}
              delay={i * 0.1}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          將游標移到 bar 上可看完整標題。BM25 偏好精確關鍵字匹配，可能漏掉同義詞或語義相近但用詞不同的論文。
        </p>
      </div>
    </div>
  );
}
