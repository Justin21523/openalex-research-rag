import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, RotateCcw, Database, Check, Sparkles } from 'lucide-react';
import { api, streamPipelineTrace } from '../api/client.js';
import { useT } from '../i18n/LanguageContext.jsx';
import UploadZone from '../components/playground/UploadZone.jsx';
import StageCard from '../components/pipeline/StageCard.jsx';
import Stage1Raw     from '../components/pipeline/stages/Stage1Raw.jsx';
import Stage2Clean   from '../components/pipeline/stages/Stage2Clean.jsx';
import Stage3BM25    from '../components/pipeline/stages/Stage3BM25.jsx';
import Stage4Vector  from '../components/pipeline/stages/Stage4Vector.jsx';
import Stage5Fusion  from '../components/pipeline/stages/Stage5Fusion.jsx';
import Stage6Context from '../components/pipeline/stages/Stage6Context.jsx';
import Stage7Answer  from '../components/pipeline/stages/Stage7Answer.jsx';
import StepExplainer from '../components/datastory/StepExplainer.jsx';
import JourneySummary from '../components/datastory/JourneySummary.jsx';

const SAMPLES = [
  'transformer attention mechanism',
  'BERT language model pretraining',
  'graph neural network node classification',
  'retrieval augmented generation',
];

const buildStageMeta = (t) => [
  { title: t('pages.pipeline.stage1Title'), subtitle: t('pages.pipeline.stage1Subtitle'), icon: '▣' },
  { title: t('pages.pipeline.stage2Title'), subtitle: t('pages.pipeline.stage2Subtitle'), icon: '✂' },
  { title: t('pages.pipeline.stage3Title'), subtitle: t('pages.pipeline.stage3Subtitle'), icon: '#' },
  { title: t('pages.pipeline.stage4Title'), subtitle: t('pages.pipeline.stage4Subtitle'), icon: '◉' },
  { title: t('pages.pipeline.stage5Title'), subtitle: t('pages.pipeline.stage5Subtitle'), icon: '↔' },
  { title: t('pages.pipeline.stage6Title'), subtitle: t('pages.pipeline.stage6Subtitle'), icon: '□' },
  { title: t('pages.pipeline.stage7Title'), subtitle: t('pages.pipeline.stage7Subtitle'), icon: '✦' },
];

const STAGE_KEY_TO_INDEX = {
  sample_work: 0, text_cleaning: 1, bm25: 2, vector: 3, hybrid: 4, rag_context: 5, answer: 6,
};

export default function DataStory() {
  const t = useT();
  const STAGE_META = buildStageMeta(t);
  const [uploadResult, setUploadResult] = useState(null);
  const [query, setQuery] = useState('');
  const [traceData, setTraceData] = useState(null);
  const [activeStage, setActiveStage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [error, setError] = useState(null);
  const journeyRef = useRef(null);

  // Auto-advance through the stages once the trace finishes streaming.
  useEffect(() => {
    if (!autoPlay || isStreaming || !traceData || activeStage >= 6) return;
    const id = setTimeout(() => setActiveStage((s) => Math.min(6, s + 1)), 3500);
    return () => clearTimeout(id);
  }, [autoPlay, isStreaming, activeStage, traceData]);

  async function runPipeline(q) {
    if (!q.trim()) return;
    setLoading(true);
    setIsStreaming(true);
    setError(null);
    setTraceData(null);
    setActiveStage(0);
    setAutoPlay(false);
    setTimeout(() => journeyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    try {
      if (!uploadResult) {
        const sample = await api.playgroundUseSample();
        setUploadResult(sample);
      }
      for await (const evt of streamPipelineTrace(q.trim(), 5)) {
        if (evt.stage === 'error') { setError(evt.message); break; }
        if (evt.stage === 'done') {
          setTraceData((prev) => ({ ...prev, latencies_ms: evt.latencies_ms }));
          setIsStreaming(false);
          setActiveStage(0);
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

  const renderActiveStage = () => {
    const i = activeStage;
    if (i === 0) return <Stage1Raw data={traceData?.sample_work} />;
    if (i === 1) return <Stage2Clean data={traceData?.text_cleaning ? { ...traceData.text_cleaning, _query: traceData.query } : null} />;
    if (i === 2) return <Stage3BM25 data={traceData?.bm25} />;
    if (i === 3) return <Stage4Vector data={traceData?.vector} />;
    if (i === 4) return <Stage5Fusion bm25Data={traceData?.bm25} vectorData={traceData?.vector} hybridData={traceData?.hybrid} />;
    if (i === 5) return <Stage6Context data={traceData?.rag_context} />;
    return <Stage7Answer data={traceData?.answer} latenciesMs={traceData?.latencies_ms} />;
  };

  const journeyDone = !!traceData?.answer && !isStreaming;

  return (
    <div className="max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={22} className="text-violet-500" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('pages.dataStory.title')}</h1>
        </div>
        <p className="text-slate-500 text-sm max-w-2xl">{t('pages.dataStory.subtitle')}</p>
      </div>

      {/* ① Data source */}
      <section data-tour="data-source" className="mb-6">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('pages.dataStory.sourceTitle')}</h2>
        <p className="text-xs text-slate-400 mb-3">{t('pages.dataStory.sourceDesc')}</p>
        {!uploadResult ? (
          <UploadZone onComplete={setUploadResult} />
        ) : (
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
              <Check size={18} className="text-white" />
            </div>
            <div className="flex-1 text-sm">
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                {t('pages.dataStory.loadedPrefix')} {Number(uploadResult.count ?? 0).toLocaleString()} {t('pages.dataStory.loadedSuffix')}
              </span>
              <span className="text-slate-400 ml-2">{t('pages.dataStory.format')}: {uploadResult.format_detected}</span>
            </div>
            <button
              onClick={() => setUploadResult(null)}
              className="text-xs text-slate-500 hover:text-blue-600 flex items-center gap-1"
            >
              <Database size={12} /> {t('pages.dataStory.change')}
            </button>
          </div>
        )}
      </section>

      {/* ② Query */}
      <motion.section
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('pages.dataStory.queryTitle')}</h2>
        <p className="text-xs text-slate-400 mb-3">{uploadResult ? t('pages.dataStory.queryHint') : t('pages.dataStory.queryHintSample')}</p>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runPipeline(query)}
            placeholder={t('pages.dataStory.queryPlaceholder')}
            className="flex-1 px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => runPipeline(query)}
            disabled={loading || !query.trim()}
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            <Play size={14} /> {loading ? t('pages.dataStory.running') : t('pages.dataStory.run')}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((s) => (
            <button
              key={s}
              onClick={() => { setQuery(s); runPipeline(s); }}
              className="px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors border border-slate-200 dark:border-slate-600"
            >
              {s}
            </button>
          ))}
        </div>
      </motion.section>

      {error && (
        <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}

      {/* ③ Journey */}
      {traceData && (
        <section ref={journeyRef}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('pages.dataStory.journeyTitle')}</h2>
            <div className="flex items-center gap-2">
              {journeyDone && (
                <>
                  <button
                    onClick={() => setAutoPlay((p) => !p)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    {autoPlay ? <Pause size={12} /> : <Play size={12} />}
                    {autoPlay ? t('pages.dataStory.pause') : t('pages.dataStory.autoplay')}
                  </button>
                  <button
                    onClick={() => { setActiveStage(0); setAutoPlay(true); }}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    <RotateCcw size={12} /> {t('pages.dataStory.restart')}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Step tab strip */}
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4">
            {STAGE_META.map((meta, i) => {
              const reached = !!traceData && (isStreaming ? i <= activeStage : true);
              const isActive = i === activeStage;
              return (
                <button
                  key={i}
                  onClick={() => { setAutoPlay(false); setActiveStage(i); }}
                  disabled={!reached}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs whitespace-nowrap border transition-all shrink-0 ${
                    isActive
                      ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                      : reached
                        ? 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-blue-300'
                        : 'bg-slate-50 dark:bg-slate-800/50 text-slate-300 dark:text-slate-600 border-slate-100 dark:border-slate-700 cursor-not-allowed'
                  }`}
                >
                  <span>{meta.icon}</span>
                  <span>{i + 1}. {meta.title}</span>
                </button>
              );
            })}
          </div>

          {/* Active stage + explainer */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
            <div>
              <StageCard
                stageIndex={activeStage}
                title={STAGE_META[activeStage].title}
                subtitle={STAGE_META[activeStage].subtitle}
                icon={STAGE_META[activeStage].icon}
                active
                isLast
              >
                {renderActiveStage()}
              </StageCard>
            </div>
            <div className="lg:sticky lg:top-4">
              <StepExplainer stageIndex={activeStage} traceData={traceData} />
            </div>
          </div>

          {/* Summary */}
          {journeyDone && <JourneySummary traceData={traceData} />}
        </section>
      )}
    </div>
  );
}
