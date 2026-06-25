import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

function useTypewriter(text, { chunkSize = 8, intervalMs = 20 } = {}) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    if (!text) { setDisplayed(''); return; }
    let i = 0;
    setDisplayed('');
    const id = setInterval(() => {
      i += chunkSize;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, intervalMs);
    return () => clearInterval(id);
  }, [text, chunkSize, intervalMs]);
  return displayed;
}

function AnimatedCounter({ target, duration = 1200 }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!target) return;
    let frame = 0;
    const steps = Math.ceil(duration / 16);
    const step = target / steps;
    const id = setInterval(() => {
      frame++;
      setValue(Math.min(Math.round(step * frame), target));
      if (frame >= steps) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [target, duration]);
  return <span>{value.toLocaleString()}</span>;
}

const PROMPT_STRUCTURE = [
  { role: 'System',   color: 'bg-slate-700 text-slate-200',  desc: '引用規則 + 不得捏造的指令' },
  { role: 'User',     color: 'bg-blue-700 text-blue-100',    desc: '使用者的問題（query）' },
  { role: 'Context',  color: 'bg-orange-700 text-orange-100',desc: '[W...] 論文標題 + 摘要 × N 篇' },
  { role: '[Answer]', color: 'bg-emerald-700 text-emerald-100', desc: '← LLM 在此生成引用式回答' },
];

export default function Stage6Context({ data }) {
  const text = useTypewriter(data?.context_preview ?? '', { chunkSize: 14, intervalMs: 16 });

  if (!data) {
    return <div className="text-sm text-slate-400 italic text-center py-8">等待查詢...</div>;
  }

  const { context_char_length, estimated_tokens, works_used } = data;
  const tokenBudget = 4096;
  const tokenPct = Math.min((estimated_tokens / tokenBudget) * 100, 100);

  return (
    <div className="space-y-5">
      {/* Explanation */}
      <p className="text-xs text-slate-600 leading-relaxed">
        將 Top-{works_used.length} 篇論文的標題與摘要組合成 LLM 的
        <strong className="text-slate-700"> Prompt 上下文</strong>，
        每篇以 <code className="text-orange-600 bg-orange-50 px-1 rounded">[Wxxxxxxxx]</code> 標記，
        方便模型生成引用時回溯來源。Token 預算有限（約 4096 tokens），因此只使用 Top-K 篇。
      </p>

      {/* Prompt structure diagram */}
      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Prompt 結構
        </div>
        <div className="space-y-1">
          {PROMPT_STRUCTURE.map(({ role, color, desc }, i) => (
            <motion.div
              key={role}
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-3"
            >
              <span className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold ${color} w-24 text-center shrink-0`}>
                {role}
              </span>
              <div className="flex-1 flex items-center gap-2">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs text-slate-500">{desc}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Papers used chips with token contribution */}
      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          論文上下文 ({works_used.length} 篇)
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="space-y-2"
        >
          {works_used.map((w, i) => {
            const approxTokens = Math.round((w.title?.length ?? 0 + 200) / 4);
            return (
              <motion.div
                key={w.work_id}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="flex items-center gap-3 px-3 py-2 bg-white rounded-xl border border-orange-200 shadow-sm"
              >
                <span className="w-5 h-5 rounded-full bg-orange-400 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-mono text-orange-600">{w.work_id}</div>
                  <div className="text-xs text-slate-600 truncate">
                    {w.title ? w.title.slice(0, 55) : '—'}
                  </div>
                </div>
                <span className="shrink-0 text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                  ~{approxTokens}t
                </span>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Token budget */}
      <div>
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-semibold text-slate-500 uppercase tracking-wider">Token Budget</span>
          <span className="font-mono text-orange-600">
            ~<AnimatedCounter target={estimated_tokens} /> / {tokenBudget} tokens
            <span className={`ml-1.5 font-bold ${tokenPct > 80 ? 'text-red-500' : tokenPct > 60 ? 'text-amber-500' : 'text-emerald-500'}`}>
              ({tokenPct.toFixed(0)}%)
            </span>
          </span>
        </div>
        <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${tokenPct > 80 ? 'bg-gradient-to-r from-red-400 to-red-500' : tokenPct > 60 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-orange-400 to-orange-500'}`}
            initial={{ width: 0 }}
            whileInView={{ width: `${tokenPct}%` }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>0</span>
          <span className="text-slate-500">{context_char_length.toLocaleString()} chars</span>
          <span>{tokenBudget}</span>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          估算：1 token ≈ 4 字元。Context 過長會被截斷，因此只取 Top-{works_used.length} 篇最相關論文。
        </p>
      </div>

      {/* Context preview (typewriter) */}
      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Context Preview <span className="font-normal text-slate-400">(前 600 字元)</span>
        </div>
        <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs leading-relaxed h-48 overflow-y-auto">
          {text.split(/(\[W\d+\])/).map((part, i) => {
            const m = part.match(/^\[W(\d+)\]$/);
            if (m) {
              return (
                <span key={i} className="text-amber-400 font-bold bg-amber-900/30 px-0.5 rounded">
                  {part}
                </span>
              );
            }
            return <span key={i} className="text-emerald-300">{part}</span>;
          })}
          <span className="inline-block w-0.5 h-3.5 bg-emerald-400 align-middle ml-0.5 animate-pulse" />
        </div>
        <p className="mt-1 text-xs text-slate-400">
          橙色高亮的 <code className="text-amber-500">[W...]</code> 標記讓模型知道每段文字的來源，
          生成答案時直接複製引用標記。
        </p>
      </div>
    </div>
  );
}
