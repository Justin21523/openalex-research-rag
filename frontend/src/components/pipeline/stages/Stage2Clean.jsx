import { motion } from 'framer-motion';

const chipVariants = {
  hidden: { opacity: 0, x: -22, scale: 0.8 },
  show: { opacity: 1, x: 0, scale: 1 },
};
const chipContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } },
};

const STEPS = [
  {
    label: 'strip HTML',
    before: '<b>Attention</b> is all you need',
    after:  'Attention is all you need',
    color:  'border-red-200 bg-red-50',
    badge:  'bg-red-100 text-red-700',
  },
  {
    label: 'normalize Unicode',
    before: 'café, naïve, résumé',
    after:  'cafe, naive, resume',
    color:  'border-violet-200 bg-violet-50',
    badge:  'bg-violet-100 text-violet-700',
  },
  {
    label: 'lowercase + remove punct',
    before: 'BERT: Pre-training of Deep Bi-directional',
    after:  'bert pretraining of deep bidirectional',
    color:  'border-indigo-200 bg-indigo-50',
    badge:  'bg-indigo-100 text-indigo-700',
  },
];

export default function Stage2Clean({ data }) {
  if (!data) {
    return <div className="text-sm text-slate-400 italic text-center py-8">等待查詢...</div>;
  }

  const { raw_title, clean_title, query_tokens, searchable_text_preview } = data;

  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-600 leading-relaxed">
        BM25 索引使用<strong className="text-slate-700"> clean_for_bm25()</strong> 函式對文字預處理。
        原始標題/摘要經過三步清洗，確保 token 匹配不受大小寫或符號影響。
      </p>

      {/* 3-step cleaning process */}
      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          清洗流程
        </div>
        <div className="space-y-2">
          {STEPS.map(({ label, before, after, color, badge }, idx) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.12, duration: 0.35 }}
              className={`rounded-xl border p-3 ${color}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge}`}>
                  Step {idx + 1}
                </span>
                <code className="text-xs font-mono text-slate-500">{label}</code>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-white/70 rounded-lg px-2 py-1.5 text-slate-500 line-through opacity-70 truncate" title={before}>
                  {before}
                </div>
                <div className="bg-white rounded-lg px-2 py-1.5 text-emerald-700 font-medium truncate" title={after}>
                  {after}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Actual before / after for current paper */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 p-3 bg-white">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Raw Title
          </div>
          <p className="text-sm text-slate-700 font-mono break-words leading-relaxed line-clamp-3">
            {raw_title || <span className="italic text-slate-300">empty</span>}
          </p>
        </div>
        <div className="rounded-xl border border-violet-200 p-3 bg-violet-50">
          <div className="text-xs font-semibold text-violet-500 uppercase tracking-wider mb-2">
            Cleaned ✓
          </div>
          <p className="text-sm text-violet-800 font-mono break-words leading-relaxed line-clamp-3">
            {clean_title || <span className="italic text-slate-300">empty</span>}
          </p>
        </div>
      </div>

      {/* Query tokens */}
      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Query Tokens
          <code className="ml-2 font-mono text-violet-600 normal-case text-xs font-normal">
            clean_for_bm25("{data._query ?? ''}")
          </code>
        </div>
        <motion.div
          variants={chipContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="flex flex-wrap gap-2"
        >
          {query_tokens.map((tok, i) => (
            <motion.span
              key={i}
              variants={chipVariants}
              className="px-3 py-1.5 bg-violet-100 text-violet-800 rounded-full text-sm font-mono
                         border border-violet-200 shadow-sm hover:bg-violet-200 transition-colors cursor-default"
            >
              {tok}
            </motion.span>
          ))}
          {query_tokens.length === 0 && (
            <span className="text-slate-400 text-sm italic">no tokens</span>
          )}
        </motion.div>
        <p className="mt-2 text-xs text-slate-400">
          共 {query_tokens.length} 個 token，每個 token 會在 BM25 和 FTS 索引中獨立查詢。
        </p>
      </div>

      {/* Searchable text preview */}
      <div>
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          <span>build_searchable_text()</span>
          <span className="font-normal text-slate-400 normal-case text-xs">title × 2 + abstract</span>
        </div>
        <div className="bg-slate-900 rounded-xl p-3 font-mono text-xs text-emerald-300 leading-relaxed">
          {searchable_text_preview
            ? <>{searchable_text_preview.slice(0, 300)}{searchable_text_preview.length > 300 ? <span className="text-slate-500">…</span> : ''}</>
            : <span className="text-slate-500 italic">empty</span>
          }
        </div>
        <p className="mt-1 text-xs text-slate-400">
          標題出現兩次 → 提高標題詞彙的 TF 值，讓標題比摘要有更高的 BM25 分數。
        </p>
      </div>
    </div>
  );
}
