import { useEffect, useRef, useState } from 'react';
import { Database, Play, RefreshCw, CheckCircle2, Loader2, AlertCircle, Download, FileSearch } from 'lucide-react';
import { api, streamIngest } from '../api/client.js';
import { useT } from '../i18n/LanguageContext.jsx';

const DEFAULT_TOPICS = [
  'machine learning',
  'natural language processing',
  'computer vision',
  'information retrieval',
  'knowledge graphs',
  'bioinformatics',
  'climate informatics',
  'computational economics',
];

export default function IngestManager() {
  const tr = useT();
  const [status, setStatus] = useState(null);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState('');
  const [limitPerTopic, setLimitPerTopic] = useState(500);
  const [topicProgress, setTopicProgress] = useState({});
  const logsRef = useRef(null);

  // Single paper import
  const [importInput, setImportInput] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState('');

  // arXiv PDF fetch
  const [pdfLimit, setPdfLimit] = useState(500);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfMsg, setPdfMsg] = useState('');

  const refreshStatus = () => {
    api.getIngestStatus()
      .then((s) => setStatus(s))
      .catch(() => {});
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs]);

  const importPaper = async () => {
    const input = importInput.trim();
    if (!input) return;
    setImportLoading(true);
    setImportResult(null);
    setImportError('');
    try {
      let result;
      // Detect arXiv patterns: 2401.01234 or arxiv:2401.01234 or arxiv.org/abs/...
      const arxivMatch = input.match(/(?:arxiv[:/]|arxiv\.org\/abs\/)?(\d{4}\.\d{4,5}(?:v\d+)?)/i);
      if (arxivMatch) {
        result = await api.importByArxiv(arxivMatch[1]);
      } else {
        // Treat as DOI: strip https://doi.org/ prefix if present
        const doi = input.replace(/^https?:\/\/doi\.org\//i, '');
        result = await api.importByDoi(doi);
      }
      setImportResult(result);
    } catch (e) {
      setImportError(e.message);
    } finally {
      setImportLoading(false);
    }
  };

  const triggerArxivPdfs = async () => {
    setPdfLoading(true);
    setPdfMsg('');
    try {
      const res = await api.fetchArxivPdfs(pdfLimit);
      setPdfMsg(res.message || tr('pages.ingest.started', 'Started!'));
    } catch (e) {
      setPdfMsg(`${tr('pages.ingest.errorPrefix', 'Error')}: ${e.message}`);
    } finally {
      setPdfLoading(false);
    }
  };

  const startIngest = async () => {
    setRunning(true);
    setLogs([]);
    setError(null);
    setTopicProgress({});
    try {
      for await (const event of streamIngest({ email, limitPerTopic })) {
        if (event.type === 'progress') {
          const { topic, topic_fetched, total_fetched } = event;
          setLogs((l) => [...l.slice(-200), `[${new Date().toLocaleTimeString()}] ${topic}: ${topic_fetched.toLocaleString()} ${tr('pages.ingest.worksFetched', 'works fetched')} (${tr('pages.ingest.total', 'total')}: ${total_fetched.toLocaleString()})`]);
          setTopicProgress((p) => ({ ...p, [topic]: topic_fetched }));
        } else if (event.type === 'done') {
          setLogs((l) => [...l, `${tr('pages.ingest.doneTotal', 'Done! Total:')} ${event.total_fetched?.toLocaleString()} ${tr('pages.ingest.works', 'works')}.`]);
          refreshStatus();
        } else if (event.type === 'error') {
          setError(event.message);
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Database size={22} className="text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{tr('pages.ingest.title', 'Data Manager')}</h1>
          <p className="text-sm text-slate-500">{tr('pages.ingest.subtitle', 'Bulk-fetch papers from OpenAlex into the knowledge base')}</p>
        </div>
      </div>

      {/* DB Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: tr('pages.ingest.worksInDb', 'Works in DB'), value: status?.total_fetched?.toLocaleString() ?? '—' },
          { label: tr('pages.ingest.statusLabel', 'Status'), value: status?.running ? tr('pages.ingest.statusRunning', 'Running…') : tr('pages.ingest.statusIdle', 'Idle') },
          { label: tr('pages.ingest.lastTopic', 'Last topic'), value: status?.current_topic || '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className="text-lg font-bold text-slate-900 truncate">{value}</p>
          </div>
        ))}
      </div>

      {/* Config */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h2 className="font-semibold text-slate-800 text-sm">{tr('pages.ingest.fetchConfig', 'Fetch Configuration')}</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">{tr('pages.ingest.emailLabel', 'OpenAlex Polite-Pool Email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">{tr('pages.ingest.limitPerTopicLabel', 'Limit per Topic')}</label>
            <input
              type="number"
              value={limitPerTopic}
              onChange={(e) => setLimitPerTopic(Number(e.target.value))}
              min={100}
              max={25000}
              step={500}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Topics grid */}
        <div>
          <p className="text-xs text-slate-500 mb-2">{tr('pages.ingest.topicsToFetch', 'Topics to fetch')} ({DEFAULT_TOPICS.length} × {limitPerTopic.toLocaleString()} ≈ {(DEFAULT_TOPICS.length * limitPerTopic).toLocaleString()} {tr('pages.ingest.works', 'works')})</p>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_TOPICS.map((t) => {
              const fetched = topicProgress[t];
              return (
                <span
                  key={t}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
                    fetched != null
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  {fetched != null && <CheckCircle2 size={10} />}
                  {t}
                  {fetched != null && <span className="ml-1 text-emerald-500">{fetched.toLocaleString()}</span>}
                </span>
              );
            })}
          </div>
        </div>

        <button
          onClick={startIngest}
          disabled={running}
          className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold
                     rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          {running ? tr('pages.ingest.fetching', 'Fetching…') : tr('pages.ingest.startFetch', 'Start Fetch')}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Live log */}
      {logs.length > 0 && (
        <div className="bg-slate-900 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">{tr('pages.ingest.progressLog', 'Progress Log')}</span>
            {running && <RefreshCw size={12} className="text-slate-500 animate-spin" />}
          </div>
          <div
            ref={logsRef}
            className="h-56 overflow-y-auto space-y-0.5 font-mono text-xs text-slate-300"
          >
            {logs.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      )}

      {/* Single Paper Import */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h2 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
          <FileSearch size={15} className="text-blue-500" />
          {tr('pages.ingest.singleImport', 'Single Paper Import (DOI or arXiv)')}
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={importInput}
            onChange={(e) => setImportInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && importPaper()}
            placeholder="10.1145/1234567 or 2401.01234 or https://doi.org/…"
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={importLoading}
          />
          <button
            onClick={importPaper}
            disabled={importLoading || !importInput.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg
                       hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {importLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {tr('pages.ingest.import', 'Import')}
          </button>
        </div>
        {importError && <p className="text-sm text-red-600">{importError}</p>}
        {importResult && (
          <div className="flex items-start gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <CheckCircle2 size={15} className="text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-900 line-clamp-2">{importResult.title || importResult.work_id}</p>
              <p className="text-xs text-emerald-600 mt-0.5">{importResult.work_id}</p>
            </div>
          </div>
        )}
      </div>

      {/* arXiv PDF Trigger */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h2 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
          <Download size={15} className="text-purple-500" />
          {tr('pages.ingest.fetchArxivFullTexts', 'Fetch arXiv Full Texts')}
        </h2>
        <p className="text-xs text-slate-500">
          {tr('pages.ingest.fetchArxivDesc', 'Download PDFs from arXiv and extract full-text for papers with an arXiv ID. Runs in background.')}
        </p>
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-500 shrink-0">{tr('pages.ingest.maxPapers', 'Max papers:')}</label>
          <input
            type="number"
            value={pdfLimit}
            onChange={(e) => setPdfLimit(Number(e.target.value))}
            min={10}
            max={5000}
            step={100}
            className="w-24 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={pdfLoading}
          />
          <button
            onClick={triggerArxivPdfs}
            disabled={pdfLoading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg
                       hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {pdfLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {tr('pages.ingest.startFetch', 'Start Fetch')}
          </button>
        </div>
        {pdfMsg && <p className="text-sm text-slate-600">{pdfMsg}</p>}
      </div>

      {/* Instructions */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <p className="font-semibold mb-1">{tr('pages.ingest.cliAlternative', 'CLI alternative (recommended for large fetches):')}</p>
        <code className="block bg-amber-100 rounded px-3 py-2 text-xs font-mono">
          python scripts/fetch_bulk_data.py --all-topics --limit-per-topic 6500 --email you@example.com
        </code>
        <p className="mt-2 text-xs text-amber-700">
          {tr('pages.ingest.cliNote', 'For ~50k papers, CLI is more reliable than the browser-based stream. arXiv PDFs and Semantic Scholar citation contexts also require CLI scripts.')}
        </p>
      </div>
    </div>
  );
}
