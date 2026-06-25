import { motion } from 'framer-motion';

const FIELD_COLORS = {
  work_id:               'text-sky-400',
  title:                 'text-slate-100 font-medium',
  abstract_preview:      'text-slate-400',
  publication_year:      'text-amber-400',
  referenced_works_count:'text-purple-400',
  concepts_preview:      '',
};

const container = { hidden: {}, show: { transition: { staggerChildren: 0.14 } } };
const item = { hidden: { opacity: 0, x: -20 }, show: { opacity: 1, x: 0, transition: { duration: 0.35 } } };

function JsonRow({ keyName, val }) {
  const color = FIELD_COLORS[keyName] || 'text-emerald-300';
  return (
    <motion.div variants={item} className="flex gap-3 py-1.5 border-b border-slate-700/40 last:border-0 group">
      {/* Scanning highlight effect on row */}
      <motion.div
        className="absolute left-0 right-0 h-full bg-sky-400/5 rounded pointer-events-none"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: [0, 1, 0] }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.1 }}
      />
      <span className="text-purple-300 shrink-0 font-mono text-xs w-44">"{keyName}":</span>
      <span className={`${color} flex-1 min-w-0 break-words font-mono text-xs leading-relaxed`}>
        {Array.isArray(val) ? (
          <span className="flex flex-wrap gap-1 mt-0.5">
            {val.map((v, i) => (
              <span key={i} className="px-1.5 py-0.5 bg-emerald-900/60 text-emerald-300 rounded text-xs border border-emerald-700/40">
                "{v}"
              </span>
            ))}
            {val.length === 0 && <span className="text-slate-500 italic">[]</span>}
          </span>
        ) : (
          <span className="line-clamp-2">
            {typeof val === 'string'
              ? `"${val.slice(0, 130)}${val.length > 130 ? '…' : '"}' }`
              : String(val ?? 'null')}
          </span>
        )}
      </span>
    </motion.div>
  );
}

export default function Stage1Raw({ data }) {
  if (!data) {
    return (
      <div className="text-sm text-slate-400 text-center py-8 italic">
        Enter a query above and click Run to start the pipeline tour.
      </div>
    );
  }

  const { work_id, title, publication_year, referenced_works_count, concepts_preview, abstract_preview } = data;

  const fields = [
    ['work_id',                work_id],
    ['title',                  title || '—'],
    ['publication_year',       publication_year],
    ['referenced_works_count', referenced_works_count],
    ['concepts_preview',       concepts_preview || []],
    ['abstract_preview',       abstract_preview || '—'],
  ];

  return (
    <div className="space-y-5">
      {/* Explanatory header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs text-slate-600 leading-relaxed">
            <strong className="text-slate-700">OpenAlex</strong> 是全球最大的開放學術圖譜，涵蓋超過 2.5 億篇論文。
            原始資料以 JSON 格式儲存在 <code className="text-sky-600 bg-sky-50 px-1 rounded">DuckDB</code>，
            每筆包含 work_id、標題、摘要、概念標籤、引用列表等欄位。
          </p>
          <p className="text-xs text-slate-500">
            以下隨機抽取一篇論文，展示原始欄位結構。
          </p>
        </div>
        <span className="shrink-0 px-2 py-0.5 bg-sky-100 text-sky-700 text-xs rounded-full font-medium border border-sky-200">
          OpenAlex CC0
        </span>
      </div>

      {/* Key stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '引用其他論文', value: referenced_works_count ?? 0, unit: '篇', color: 'bg-purple-50 border-purple-200 text-purple-700' },
          { label: '概念標籤', value: (concepts_preview ?? []).length, unit: '個', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
          { label: '摘要長度', value: (abstract_preview ?? '').length, unit: '字元', color: 'bg-amber-50 border-amber-200 text-amber-700' },
        ].map(({ label, value, unit, color }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3 }}
            className={`rounded-xl border p-3 text-center ${color}`}
          >
            <div className="text-lg font-bold">{value.toLocaleString()}</div>
            <div className="text-xs opacity-70">{label}</div>
            <div className="text-xs font-medium">{unit}</div>
          </motion.div>
        ))}
      </div>

      {/* JSON viewer */}
      <div className="relative bg-slate-900 rounded-xl overflow-hidden">
        {/* Animated scan line */}
        <motion.div
          className="absolute left-0 right-0 h-px bg-sky-400/40 z-10 pointer-events-none"
          initial={{ top: '0%' }}
          whileInView={{ top: ['0%', '100%'] }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, ease: 'linear', delay: 0.2 }}
        />
        <div className="p-4 font-mono text-xs">
          <div className="text-slate-400 mb-2">{'{'}</div>
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="relative pl-4 space-y-0"
          >
            {fields.map(([k, val]) => (
              <JsonRow key={k} keyName={k} val={val} />
            ))}
          </motion.div>
          <div className="text-slate-400 mt-2">{'}'}</div>
        </div>
      </div>

      {/* Reference graph hint */}
      {referenced_works_count > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8 }}
          className="flex items-center gap-2 px-3 py-2.5 bg-purple-50 border border-purple-200 rounded-xl"
        >
          <span className="text-lg">🔗</span>
          <p className="text-xs text-purple-700">
            此論文的 <strong>{referenced_works_count.toLocaleString()}</strong> 篇參考文獻
            會被 Multi-hop RAG 用來擴展搜尋範圍（在 Stage 7 中展示）。
          </p>
        </motion.div>
      )}
    </div>
  );
}
