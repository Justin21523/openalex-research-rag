import { useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Database, Scissors, Hash, Cpu, GitMerge, AlignLeft, Sparkles, Play,
} from 'lucide-react';
import { streamPipelineTrace } from '../api/client';
import { useT } from '../i18n/LanguageContext.jsx';
import StageCard from '../components/pipeline/StageCard';
import TourPanel from '../components/pipeline/TourPanel';
import Stage1Raw      from '../components/pipeline/stages/Stage1Raw';
import Stage2Clean    from '../components/pipeline/stages/Stage2Clean';
import Stage3BM25     from '../components/pipeline/stages/Stage3BM25';
import Stage4Vector   from '../components/pipeline/stages/Stage4Vector';
import Stage5Fusion   from '../components/pipeline/stages/Stage5Fusion';
import Stage6Context  from '../components/pipeline/stages/Stage6Context';
import Stage7Answer   from '../components/pipeline/stages/Stage7Answer';

const SAMPLES = [
  'transformer attention mechanism',
  'BERT language model pretraining',
  'graph neural network node classification',
  'retrieval augmented generation',
  'diffusion model image synthesis',
];

const buildStageMeta = (tr) => [
  { title: tr('pages.pipeline.stage1Title', 'Raw OpenAlex Data'),    subtitle: tr('pages.pipeline.stage1Subtitle', 'Ingest → DuckDB'),             icon: '🗄️' },
  { title: tr('pages.pipeline.stage2Title', 'Text Preprocessing'),   subtitle: tr('pages.pipeline.stage2Subtitle', 'clean_for_bm25 · tokenize'),   icon: '✂️' },
  { title: tr('pages.pipeline.stage3Title', 'BM25 Scoring'),         subtitle: tr('pages.pipeline.stage3Subtitle', 'Sparse keyword retrieval'),    icon: '#️⃣' },
  { title: tr('pages.pipeline.stage4Title', 'Vector Embedding'),     subtitle: tr('pages.pipeline.stage4Subtitle', 'all-MiniLM-L6-v2 · 384-dim'),  icon: '🧠' },
  { title: tr('pages.pipeline.stage5Title', 'Hybrid RRF Fusion'),    subtitle: tr('pages.pipeline.stage5Subtitle', 'BM25 + Vector → RRF score'),   icon: '🔀' },
  { title: tr('pages.pipeline.stage6Title', 'RAG Context Assembly'), subtitle: tr('pages.pipeline.stage6Subtitle', 'Build LLM prompt window'),      icon: '📄' },
  { title: tr('pages.pipeline.stage7Title', 'Answer Generation'),    subtitle: tr('pages.pipeline.stage7Subtitle', 'Citation-grounded response'),   icon: '💡' },
];

export default function PipelineVisualizer() {
  const tr = useT();
  const STAGE_META = buildStageMeta(tr);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [traceData, setTraceData] = useState(null);
  const [activeStage, setActiveStage] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  // Refs for each stage section
  const stageRefs = useRef(Array.from({ length: 7 }, () => ({ current: null })));
  const stageRefCallbacks = useRef(
    Array.from({ length: 7 }, (_, i) => (el) => { stageRefs.current[i].current = el; })
  );

  // Scroll to active stage when it changes
  useEffect(() => {
    const el = stageRefs.current[activeStage]?.current;
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
    }
  }, [activeStage]);

  const STAGE_KEY_TO_INDEX = {
    sample_work: 0, text_cleaning: 1, bm25: 2,
    vector: 3, hybrid: 4, rag_context: 5, answer: 6,
  };

  async function runPipeline(q) {
    if (!q.trim()) return;
    setLoading(true);
    setIsStreaming(true);
    setError(null);
    setTraceData(null);
    setActiveStage(0);
    setAutoPlay(false);
    try {
      for await (const evt of streamPipelineTrace(q.trim(), 5)) {
        if (evt.stage === 'error') { setError(evt.message); break; }
        if (evt.stage === 'done') {
          setTraceData((prev) => ({ ...prev, latencies_ms: evt.latencies_ms }));
          setIsStreaming(false);
          setAutoPlay(true);
          break;
        }
        const idx = STAGE_KEY_TO_INDEX[evt.stage];
        if (idx !== undefined) {
          setTraceData((prev) => {
            const next = { ...(prev ?? {}), [evt.stage]: evt.data };
            if (evt.stage === 'text_cleaning') next.query = q.trim();
            return next;
          });
          setActiveStage(idx);
          setLoading(false);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setIsStreaming(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    runPipeline(query);
  }

  return (
    <div className="pb-8 lg:pr-72">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{tr('pages.pipeline.title', 'Pipeline Tour')}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {tr('pages.pipeline.subtitle', 'Enter a query and trace the full journey of data from raw OpenAlex JSON to the final RAG answer.')}
        </p>
      </div>

      {/* Query input */}
      <form data-tour="pipeline-run" onSubmit={handleSubmit} className="mb-8 space-y-3">
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr('pages.pipeline.queryPlaceholder', 'e.g. transformer attention mechanism')}
            className="flex-1 px-4 py-3 text-sm border border-slate-300 rounded-xl shadow-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl
                       hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50
                       disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Play size={14} />
            {loading ? tr('pages.pipeline.running', 'Running…') : tr('pages.pipeline.runPipeline', 'Run Pipeline')}
          </button>
        </div>

        {/* Sample queries */}
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { setQuery(s); runPipeline(s); }}
              className="px-3 py-1.5 text-xs bg-slate-100 text-slate-600 rounded-lg
                         hover:bg-slate-200 transition-colors border border-slate-200"
            >
              {s}
            </button>
          ))}
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4 mb-6">
          {[1,2,3].map((i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Pipeline stages */}
      <div className="space-y-0">
        {STAGE_META.map((meta, i) => (
          <StageCard
            key={i}
            ref={stageRefCallbacks.current[i]}
            stageIndex={i}
            title={meta.title}
            subtitle={meta.subtitle}
            icon={meta.icon}
            active={activeStage === i && !!traceData}
            isLast={i === STAGE_META.length - 1}
          >
            {i === 0 && <Stage1Raw data={traceData?.sample_work} />}
            {i === 1 && (
              <Stage2Clean
                data={traceData?.text_cleaning ? { ...traceData.text_cleaning, _query: traceData.query } : null}
              />
            )}
            {i === 2 && <Stage3BM25 data={traceData?.bm25} />}
            {i === 3 && <Stage4Vector data={traceData?.vector} />}
            {i === 4 && (
              <Stage5Fusion
                bm25Data={traceData?.bm25}
                vectorData={traceData?.vector}
                hybridData={traceData?.hybrid}
              />
            )}
            {i === 5 && <Stage6Context data={traceData?.rag_context} />}
            {i === 6 && <Stage7Answer data={traceData?.answer} latenciesMs={traceData?.latencies_ms} />}
          </StageCard>
        ))}
      </div>

      {/* Floating tour panel */}
      <TourPanel
        activeStage={activeStage}
        setActiveStage={setActiveStage}
        traceData={traceData}
        autoPlay={autoPlay}
        setAutoPlay={setAutoPlay}
        isStreaming={isStreaming}
      />
    </div>
  );
}
