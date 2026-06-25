import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileJson, Database, AlertCircle } from 'lucide-react';
import { api } from '../../api/client';

const FORMAT_LABELS = {
  simple_json: 'Simple JSON',
  csv: 'CSV',
  openalex_json: 'OpenAlex JSON',
  unknown: 'Unknown',
};

const FORMAT_COLORS = {
  simple_json: 'bg-blue-100 text-blue-700 border-blue-200',
  csv: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  openalex_json: 'bg-purple-100 text-purple-700 border-purple-200',
  unknown: 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function UploadZone({ onComplete }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  async function processFile(file) {
    setLoading(true);
    setError(null);
    try {
      const result = await api.playgroundUploadFile(file);
      onComplete(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function useSample() {
    setLoading(true);
    setError(null);
    try {
      const result = await api.playgroundUseSample();
      onComplete(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  return (
    <div className="space-y-4">
      {/* Drag and drop zone */}
      <motion.div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        animate={{ borderColor: dragging ? '#3b82f6' : '#e2e8f0', scale: dragging ? 1.01 : 1 }}
        transition={{ duration: 0.15 }}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-colors
          ${dragging ? 'bg-blue-50 border-blue-400' : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".json,.csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
        />

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-500">Processing…</p>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                <Upload size={22} className="text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  拖曳檔案或點擊選取
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  支援 <code className="bg-slate-100 px-1 rounded">.json</code> 和{' '}
                  <code className="bg-slate-100 px-1 rounded">.csv</code>
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Format guide */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <FileJson size={14} className="text-blue-600" />
            <span className="text-xs font-semibold text-blue-700">Simple JSON</span>
          </div>
          <code className="text-xs text-blue-600 block leading-relaxed">
            {`[{"title":"...",\n  "abstract":"...",\n  "year":2024}]`}
          </code>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <FileJson size={14} className="text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-700">CSV</span>
          </div>
          <code className="text-xs text-emerald-600 block leading-relaxed">
            {`title,abstract,year\n"Attention is...","We..."\n2017`}
          </code>
        </div>
      </div>

      {/* OR separator */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs text-slate-400">或</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      {/* Sample data button */}
      <button
        onClick={useSample}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white
                   rounded-xl text-sm font-medium hover:bg-slate-800 disabled:opacity-50
                   disabled:cursor-not-allowed transition-colors"
      >
        <Database size={16} />
        使用內建 Sample Data（OpenAlex 200 篇論文）
      </button>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl"
        >
          <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{error}</p>
        </motion.div>
      )}
    </div>
  );
}

export function UploadPreview({ result }) {
  if (!result) return null;
  const { count, format_detected, duplicate_skipped, sample_works, latency_ms } = result;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
          <div className="text-xl font-bold text-emerald-700">{count}</div>
          <div className="text-xs text-emerald-600">論文已解析</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
          <div className={`text-xs font-semibold px-2 py-1 rounded-full border mx-auto w-fit ${FORMAT_COLORS[format_detected] ?? FORMAT_COLORS.unknown}`}>
            {FORMAT_LABELS[format_detected] ?? format_detected}
          </div>
          <div className="text-xs text-slate-400 mt-1">格式</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
          <div className="text-sm font-bold text-slate-600">{latency_ms?.toFixed(0)} ms</div>
          <div className="text-xs text-slate-400">耗時</div>
          {duplicate_skipped > 0 && (
            <div className="text-xs text-amber-600 mt-0.5">{duplicate_skipped} 重複已跳過</div>
          )}
        </div>
      </div>

      {sample_works?.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            前 {sample_works.length} 筆預覽
          </div>
          <div className="space-y-1.5">
            {sample_works.map((w, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-100 rounded-lg">
                <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-mono text-slate-400">{w.work_id}</div>
                  <div className="text-xs text-slate-700 truncate">{w.title || '(no title)'}</div>
                </div>
                {w.year && <span className="text-xs text-slate-400 shrink-0">{w.year}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
