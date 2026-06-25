import { useState, useRef, useEffect } from 'react';
import { FileText, Search, Download, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { streamLiteratureReview, api } from '../api/client.js';
import Markdown from '../components/ui/Markdown.jsx';
import { useT } from '../i18n/LanguageContext.jsx';

const FOCUS_OPTIONS = [
  { value: 'review', label: 'Literature Review', desc: 'Structured overview with key findings and future directions', lk: 'focusReviewLabel', dk: 'focusReviewDesc' },
  { value: 'gaps',   label: 'Research Gap Finder', desc: 'Identify open problems and under-explored areas', lk: 'focusGapsLabel', dk: 'focusGapsDesc' },
];

export default function LiteratureReview() {
  const [topic, setTopic] = useState('');
  const [numPapers, setNumPapers] = useState(15);
  const [focus, setFocus] = useState('review');
  const [streaming, setStreaming] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [topConcepts, setTopConcepts] = useState([]);
  const abortRef = useRef(null);
  const tr = useT();

  useEffect(() => {
    api.getTopConcepts(12).then((res) => {
      const all = Array.isArray(res) ? res : (res?.concepts ?? []);
      setTopConcepts(all.filter((c) =>
        !['Computer science','Mathematics','Philosophy'].includes(c.concept_name)
      ).slice(0, 10));
    }).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!topic.trim()) return;
    setStreaming(true);
    setText('');
    setError('');

    try {
      for await (const event of streamLiteratureReview({ topic, num_papers: numPapers, focus })) {
        if (event.type === 'token') {
          setText((prev) => prev + event.content);
        } else if (event.type === 'done') {
          setText((prev) => prev || event.answer_text || '');
        } else if (event.type === 'error') {
          setError(event.message);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setStreaming(false);
    }
  }

  function handleExport() {
    const blob = new Blob([`# ${focus === 'gaps' ? 'Research Gaps' : 'Literature Review'}: ${topic}\n\n${text}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${focus === 'gaps' ? 'research-gaps' : 'literature-review'}-${topic.slice(0, 30).replace(/\s+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div data-tour="literature-review" className="flex items-center gap-3 mb-6">
        <FileText size={24} className="text-blue-600 dark:text-blue-400" />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{tr('pages.literatureReview.title', 'Literature Review')}</h1>
      </div>

      {/* Focus selector */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {FOCUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFocus(opt.value)}
            className={`text-left p-4 rounded-xl border-2 transition-colors ${
              focus === opt.value
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <p className="font-semibold text-sm text-slate-900 dark:text-white">{tr(`pages.literatureReview.${opt.lk}`, opt.label)}</p>
            <p className="text-xs text-slate-500 mt-0.5">{tr(`pages.literatureReview.${opt.dk}`, opt.desc)}</p>
          </button>
        ))}
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 mb-5">
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            {tr('pages.literatureReview.researchTopic', 'Research Topic')}
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={tr('pages.literatureReview.topicPlaceholder', 'e.g. transformer attention mechanisms, federated learning, protein structure prediction')}
            className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={streaming}
          />
          {topConcepts.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {topConcepts.map((c) => (
                <button
                  key={c.concept_name}
                  type="button"
                  disabled={streaming}
                  onClick={() => setTopic(c.concept_name)}
                  className="px-2.5 py-1 text-xs rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-700 dark:hover:text-blue-300 text-slate-600 dark:text-slate-400 transition-colors border border-slate-200 dark:border-slate-600 disabled:opacity-40"
                >
                  {c.concept_name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 mb-4">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 shrink-0">
            {tr('pages.literatureReview.papersToAnalyze', 'Papers to analyze:')} <span className="text-blue-600 dark:text-blue-400 font-bold">{numPapers}</span>
          </label>
          <input
            type="range"
            min={5}
            max={20}
            value={numPapers}
            onChange={(e) => setNumPapers(Number(e.target.value))}
            className="flex-1"
            disabled={streaming}
          />
        </div>

        <button
          type="submit"
          disabled={!topic.trim() || streaming}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium text-sm transition-colors"
        >
          {streaming ? (
            <><Loader2 size={16} className="animate-spin" /> {tr('pages.literatureReview.generating', 'Generating…')}</>
          ) : (
            <><Search size={16} /> {tr('pages.literatureReview.generate', 'Generate')} {focus === 'gaps' ? tr('pages.literatureReview.gapAnalysis', 'Gap Analysis') : tr('pages.literatureReview.literatureReview', 'Literature Review')}</>
          )}
        </button>
      </form>

      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Output */}
      {(text || streaming) && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 dark:text-white">
              {focus === 'gaps' ? tr('pages.literatureReview.researchGaps', 'Research Gaps') : tr('pages.literatureReview.literatureReview', 'Literature Review')}{topic ? `: ${topic}` : ''}
            </h2>
            {text && !streaming && (
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600"
              >
                <Download size={13} /> {tr('pages.literatureReview.exportMarkdown', 'Export Markdown')}
              </button>
            )}
          </div>
          <Markdown text={text} streaming={streaming} />
        </div>
      )}
    </div>
  );
}
