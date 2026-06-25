import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Database, Hash, Cpu, Search, MessageSquare, BarChart2,
  FlaskConical, Trash2, RefreshCw,
} from 'lucide-react';
import UploadZone, { UploadPreview } from '../components/playground/UploadZone';
import StepPanel from '../components/playground/StepPanel';
import BuildStep from '../components/playground/BuildStep';
import SearchTest from '../components/playground/SearchTest';
import RagTest from '../components/playground/RagTest';
import EvalDashboard from '../components/playground/EvalDashboard';
import { BM25Aura, EmbeddingsAura } from '../components/playground/PlaygroundAura';
import { api, streamBuildEmbeddings } from '../api/client';
import { useT } from '../i18n/LanguageContext.jsx';

const STEP_KEYS = ['source', 'bm25', 'embeddings', 'search', 'rag', 'evaluate'];

const INIT_STATUS = {
  source: 'active',
  bm25: 'locked',
  embeddings: 'locked',
  search: 'locked',
  rag: 'locked',
  evaluate: 'locked',
};

function unlock(status, key) {
  return { ...status, [key]: status[key] === 'locked' ? 'active' : status[key] };
}

function SectionHeader({ icon: Icon, label, color, step }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={16} className="text-white" />
      </div>
      <div>
        <span className="text-xs text-slate-400 font-medium">Step {step}</span>
        <h2 className="text-base font-bold text-slate-800 leading-tight">{label}</h2>
      </div>
    </div>
  );
}

function Section({ children, id, active }) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.4 }}
      className={`rounded-2xl border-2 p-6 mb-6 transition-all duration-300 ${
        active ? 'border-blue-200 bg-blue-50/30 shadow-sm' : 'border-slate-100 bg-white'
      }`}
    >
      {children}
    </motion.section>
  );
}

export default function Playground() {
  const t = useT();
  const [stepStatus, setStepStatus] = useState(INIT_STATUS);
  const [currentStep, setCurrentStep] = useState('source');

  // Step results
  const [uploadResult, setUploadResult] = useState(null);
  const [bm25Result, setBm25Result] = useState(null);
  const [embResult, setEmbResult] = useState(null);
  const [embProgress, setEmbProgress] = useState(null); // {done, total}
  const [stats, setStats] = useState(null);

  const sectionRefs = Object.fromEntries(STEP_KEYS.map((k) => [k, useRef(null)]));

  function setStatus(key, status) {
    setStepStatus((prev) => ({ ...prev, [key]: status }));
  }

  function completeStep(key, nextKey) {
    setStepStatus((prev) => {
      const next = { ...prev, [key]: 'done' };
      if (nextKey) next[nextKey] = next[nextKey] === 'locked' ? 'active' : next[nextKey];
      return next;
    });
    if (nextKey) setCurrentStep(nextKey);
  }

  function scrollTo(key) {
    sectionRefs[key]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setCurrentStep(key);
  }

  async function refreshStats() {
    try { setStats(await api.playgroundStats()); } catch { /* ignore */ }
  }

  useEffect(() => { refreshStats(); }, []);

  // ── Step handlers ─────────────────────────────────────────────────────────

  function onUploadComplete(result) {
    setUploadResult(result);
    completeStep('source', 'bm25');
    refreshStats();
  }

  async function runBm25() {
    setStatus('bm25', 'running');
    const result = await api.playgroundBuildBm25();
    setBm25Result(result);
    await refreshStats();
    completeStep('bm25', 'embeddings');
  }

  async function runEmbeddings() {
    setStatus('embeddings', 'running');
    setEmbProgress({ done: 0, total: null });
    let finalResult = null;

    for await (const evt of streamBuildEmbeddings()) {
      if (evt.error) throw new Error(evt.error);
      if (evt.finished) {
        finalResult = evt;
      } else if (evt.done != null) {
        setEmbProgress({ done: evt.done, total: evt.total });
      }
    }
    setEmbResult(finalResult);
    setEmbProgress(null);
    await refreshStats();
    completeStep('embeddings', 'search');
  }

  function skipEmbeddings() {
    setEmbResult({ skipped: true });
    completeStep('embeddings', 'search');
    setStepStatus((prev) => ({ ...prev, embeddings: 'skipped' }));
  }

  function onSearchDone() {
    if (stepStatus.search !== 'done') completeStep('search', 'rag');
  }

  function onRagDone() {
    if (stepStatus.rag !== 'done') completeStep('rag', 'evaluate');
  }

  async function clearData() {
    await api.playgroundClear();
    setStepStatus(INIT_STATUS);
    setCurrentStep('source');
    setUploadResult(null);
    setBm25Result(null);
    setEmbResult(null);
    setEmbProgress(null);
    refreshStats();
  }

  return (
    <div className="relative max-w-2xl lg:pr-64">
      {/* Header */}
      <div data-tour="playground" className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600
                          flex items-center justify-center shadow-lg">
            <FlaskConical size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t('pages.playground.title')}</h1>
            <p className="text-xs text-slate-500">{t('pages.playground.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={clearData}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-500
                     border border-red-200 hover:bg-red-50 transition-colors"
        >
          <Trash2 size={12} />
          {t('pages.playground.clearData')}
        </button>
      </div>

      {/* Step 1 — Upload */}
      <div ref={sectionRefs.source}>
        <Section id="source" active={currentStep === 'source'}>
          <SectionHeader icon={Upload} label={t('pages.playground.s1')} color="bg-sky-500" step={1} />
          {uploadResult ? (
            <div className="space-y-4">
              <UploadPreview result={uploadResult} />
              <button
                onClick={() => { setUploadResult(null); setStatus('source', 'active'); setCurrentStep('source'); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-500 border border-slate-200 hover:bg-slate-50"
              >
                <RefreshCw size={11} />
                {t('pages.playground.reselect')}
              </button>
            </div>
          ) : (
            <UploadZone onComplete={onUploadComplete} />
          )}
        </Section>
      </div>

      {/* Step 2 — BM25 */}
      <div ref={sectionRefs.bm25} className="relative overflow-visible">
        <AnimatePresence>
          {stepStatus.bm25 === 'running' && <BM25Aura />}
        </AnimatePresence>
        <Section id="bm25" active={currentStep === 'bm25'}>
          <SectionHeader icon={Hash} label={t('pages.playground.s2')} color="bg-amber-500" step={2} />
          <BuildStep
            label={t('pages.playground.bm25Label')}
            description={t('pages.playground.bm25Desc')}
            buttonLabel="Build BM25"
            color="amber"
            status={stepStatus.bm25}
            result={bm25Result}
            onRun={runBm25}
            renderResult={(r) => (
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-amber-50 border border-amber-100 px-2.5 py-2 text-center">
                  <div className="text-xs text-amber-600">{t('pages.playground.docCount')}</div>
                  <div className="text-sm font-bold text-amber-800">{r.doc_count?.toLocaleString()}</div>
                </div>
                <div className="rounded-lg bg-amber-50 border border-amber-100 px-2.5 py-2 text-center">
                  <div className="text-xs text-amber-600">{t('pages.playground.vocab')}</div>
                  <div className="text-sm font-bold text-amber-800">{r.extra?.vocab_size?.toLocaleString()}</div>
                </div>
                <div className="rounded-lg bg-amber-50 border border-amber-100 px-2.5 py-2 text-center">
                  <div className="text-xs text-amber-600">{t('pages.playground.buildTime')}</div>
                  <div className="text-sm font-bold text-amber-800">{r.build_time_ms?.toFixed(0)} ms</div>
                </div>
              </div>
            )}
          />
        </Section>
      </div>

      {/* Step 3 — Embeddings */}
      <div ref={sectionRefs.embeddings} className="relative overflow-visible">
        <AnimatePresence>
          {stepStatus.embeddings === 'running' && <EmbeddingsAura />}
        </AnimatePresence>
        <Section id="embeddings" active={currentStep === 'embeddings'}>
          <SectionHeader icon={Cpu} label={t('pages.playground.s3')} color="bg-purple-600" step={3} />
          <BuildStep
            label={t('pages.playground.embLabel')}
            description={t('pages.playground.embDesc')}
            buttonLabel="Build Embeddings"
            skipLabel={t('pages.playground.skip')}
            color="purple"
            status={stepStatus.embeddings}
            result={embResult && !embResult.skipped ? embResult : null}
            progressValue={embProgress?.done}
            progressTotal={embProgress?.total}
            onRun={runEmbeddings}
            onSkip={skipEmbeddings}
            renderResult={(r) => (
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-purple-50 border border-purple-100 px-2.5 py-2 text-center">
                  <div className="text-xs text-purple-600">{t('pages.playground.embedded')}</div>
                  <div className="text-sm font-bold text-purple-800">{r.embedded_count?.toLocaleString()}</div>
                </div>
                <div className="rounded-lg bg-purple-50 border border-purple-100 px-2.5 py-2 text-center">
                  <div className="text-xs text-purple-600">{t('pages.playground.dim')}</div>
                  <div className="text-sm font-bold text-purple-800">{r.embedding_dim}</div>
                </div>
                <div className="rounded-lg bg-purple-50 border border-purple-100 px-2.5 py-2 text-center">
                  <div className="text-xs text-purple-600">{t('pages.playground.elapsed')}</div>
                  <div className="text-sm font-bold text-purple-800">{r.build_time_ms?.toFixed(0)} ms</div>
                </div>
              </div>
            )}
          />
        </Section>
      </div>

      {/* Step 4 — Search Test */}
      <div ref={sectionRefs.search}>
        <Section id="search" active={currentStep === 'search'}>
          <SectionHeader icon={Search} label={t('pages.playground.s4')} color="bg-teal-600" step={4} />
          {stepStatus.search === 'locked' ? (
            <div className="py-6 text-center text-sm text-slate-400">
              {t('pages.playground.lockedBm25')}
            </div>
          ) : (
            <div>
              <SearchTest />
              {stepStatus.search !== 'done' && (
                <button
                  onClick={onSearchDone}
                  className="mt-4 w-full px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 transition-colors"
                >
                  {t('pages.playground.next')}
                </button>
              )}
            </div>
          )}
        </Section>
      </div>

      {/* Step 5 — RAG Test */}
      <div ref={sectionRefs.rag}>
        <Section id="rag" active={currentStep === 'rag'}>
          <SectionHeader icon={MessageSquare} label={t('pages.playground.s5')} color="bg-orange-500" step={5} />
          {stepStatus.rag === 'locked' ? (
            <div className="py-6 text-center text-sm text-slate-400">
              {t('pages.playground.lockedSearch')}
            </div>
          ) : (
            <div>
              <RagTest />
              {stepStatus.rag !== 'done' && (
                <button
                  onClick={onRagDone}
                  className="mt-4 w-full px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-xl hover:bg-orange-600 transition-colors"
                >
                  {t('pages.playground.next')}
                </button>
              )}
            </div>
          )}
        </Section>
      </div>

      {/* Step 6 — Evaluation */}
      <div ref={sectionRefs.evaluate}>
        <Section id="evaluate" active={currentStep === 'evaluate'}>
          <SectionHeader icon={BarChart2} label={t('pages.playground.s6')} color="bg-emerald-600" step={6} />
          {stepStatus.evaluate === 'locked' ? (
            <div className="py-6 text-center text-sm text-slate-400">
              {t('pages.playground.lockedRag')}
            </div>
          ) : (
            <EvalDashboard stats={stats} onEvaluate={() => setStatus('evaluate', 'done')} />
          )}
        </Section>
      </div>

      {/* Floating step panel */}
      <StepPanel
        stepStatus={stepStatus}
        currentStep={currentStep}
        onJump={scrollTo}
      />
    </div>
  );
}
