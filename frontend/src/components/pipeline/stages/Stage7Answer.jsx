import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import Markdown, { CitationChip } from '../../ui/Markdown.jsx';
import { useWordReveal } from '../../../hooks/useWordReveal.js';

const SYSTEM_PROMPT = `You are a research assistant with access to a curated set of scholarly papers.
Answer the user's question using ONLY the information provided in the context below.

Rules:
1. Every factual claim MUST be followed by a citation in the format [Wxxxxxxxxx].
2. If the context does not contain enough information, say so clearly.
3. Do NOT invent facts, add outside knowledge, or cite sources not in the context.
4. Keep answers concise and focused (3-6 sentences).`;

export default function Stage7Answer({ data, latenciesMs }) {
  const [showSystem, setShowSystem] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const revealed = useWordReveal(data?.answer_text ?? '', 48);

  if (!data) {
    return <div className="text-sm text-slate-400 italic text-center py-8">等待查詢...</div>;
  }

  const { answer_text, citations, mode, latency_ms } = data;
  const isDone = revealed.length >= (answer_text?.length ?? 0);

  // Total pipeline latency estimate
  const totalMs = latenciesMs
    ? Object.values(latenciesMs).reduce((s, v) => s + (v ?? 0), 0)
    : null;

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-600 leading-relaxed flex-1 mr-4">
          <strong className="text-slate-700">提取式（Extractive）回答</strong>：
          直接從論文摘要中截取相關片段，附上引用標記，無需 LLM 推理。
          LLM 可用時切換為生成式（Generative）模式。
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 font-medium">
            {mode}
          </span>
          <span className="text-xs text-slate-400 font-mono">{latency_ms?.toFixed(0)} ms</span>
        </div>
      </div>

      {/* Extractive vs LLM comparison toggle */}
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <button
          onClick={() => setShowCompare((s) => !s)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100
                     text-xs font-medium text-slate-600 transition-colors"
        >
          <span>📊 提取式 vs LLM 生成式 對比</span>
          {showCompare ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <AnimatePresence>
          {showCompare && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <table className="w-full text-xs border-t border-slate-100">
                <thead>
                  <tr className="text-left text-slate-400 bg-slate-50">
                    <th className="px-3 py-2 font-medium">屬性</th>
                    <th className="px-3 py-2 font-medium text-amber-600">Extractive</th>
                    <th className="px-3 py-2 font-medium text-emerald-600">LLM Generative</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['來源保真度', '原文摘錄，不失真', '可能重述、改寫'],
                    ['幻覺風險', '極低（原文複製）', '需謹慎（prompt grounding）'],
                    ['回答流暢度', '可能破碎', '自然語言、連貫'],
                    ['速度', '< 5ms', '1–10 秒（取決於模型）'],
                    ['離線可用', '✓ 不需 GPU', '✗ 需要 LLM 服務'],
                  ].map(([attr, ext, llm]) => (
                    <tr key={attr} className="border-t border-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-600">{attr}</td>
                      <td className="px-3 py-2 text-amber-700">{ext}</td>
                      <td className="px-3 py-2 text-emerald-700">{llm}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* System prompt (collapsible) */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowSystem((s) => !s)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100
                     text-xs font-medium text-slate-600 transition-colors"
        >
          <span>⚙️ System Prompt</span>
          {showSystem ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <AnimatePresence>
          {showSystem && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="bg-slate-900 px-4 py-3 font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap overflow-hidden"
            >
              {SYSTEM_PROMPT}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Answer with typewriter */}
      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Generated Answer
        </div>
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <Markdown text={revealed} />
          {!isDone && (
            <span className="inline-block w-0.5 h-4 bg-emerald-600 align-middle ml-0.5 animate-pulse" />
          )}
        </div>
      </div>

      {/* Citations */}
      {citations.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Extracted Citations ({citations.length})
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap gap-1.5"
          >
            {citations.map((id) => (
              <CitationChip key={id} id={id} />
            ))}
          </motion.div>
          <p className="mt-1.5 text-xs text-slate-400">
            點擊引用標記可在 OpenAlex 查看原始論文詳情。
          </p>
        </div>
      )}

      {/* Pipeline complete banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.5, ease: 'backOut' }}
        className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50
                   border border-emerald-200 rounded-xl shadow-sm"
      >
        <motion.span
          className="text-2xl"
          animate={{ rotate: [0, 15, -10, 5, 0] }}
          transition={{ delay: 2, duration: 0.6 }}
        >
          🎉
        </motion.span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-emerald-800">Pipeline Complete</p>
          <p className="text-xs text-emerald-600">
            原始資料 → 文字清洗 → BM25 + 向量索引 → Hybrid RRF → RAG 上下文 → 引用式回答
          </p>
        </div>
        {totalMs && (
          <div className="text-right shrink-0">
            <div className="text-sm font-bold font-mono text-emerald-700">
              {totalMs.toFixed(0)} ms
            </div>
            <div className="text-xs text-emerald-500">total</div>
          </div>
        )}
        {!totalMs && (
          <div className="text-right shrink-0">
            <div className="text-sm font-bold font-mono text-emerald-700">
              {latency_ms?.toFixed(0)} ms
            </div>
            <div className="text-xs text-emerald-500">answer</div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
