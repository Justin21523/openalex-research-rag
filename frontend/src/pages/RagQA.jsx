import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Cpu, Layers, Zap, Plus, Trash2, MessageSquare, Send, Loader2, ChevronDown, ChevronUp, ExternalLink,
  Sparkles, Wand2, Lightbulb,
} from 'lucide-react';
import { api, streamConversationAsk } from '../api/client.js';
import Markdown, { CitationChip } from '../components/ui/Markdown.jsx';
import { useT } from '../i18n/LanguageContext.jsx';

// Question templates — {x} is filled from a chosen concept.
const QUESTION_TEMPLATES = [
  { id: 'recent',   label: 'Recent advances in…',        build: (c) => `What are recent advances in ${c}?` },
  { id: 'datasets', label: 'Datasets used for…',         build: (c) => `What datasets are commonly used for ${c}?` },
  { id: 'challenges', label: 'Key challenges in…',       build: (c) => `What are the key challenges and open problems in ${c}?` },
  { id: 'methods',  label: 'Main methods/approaches in…', build: (c) => `What are the main methods and approaches used in ${c}?` },
  { id: 'how',      label: 'How does … work?',           build: (c) => `How does ${c} work?` },
  { id: 'apps',     label: 'Applications of…',           build: (c) => `What are the practical applications of ${c}?` },
];

// Ready-made demo questions for the empty state.
const DEMO_QUESTIONS = [
  'What are recent advances in transformer attention mechanisms?',
  'Compare BERT and GPT approaches to language modeling',
  'What datasets are commonly used for graph neural networks?',
  'How does retrieval-augmented generation reduce hallucination?',
  'What are the main challenges in federated learning?',
  'Explain contrastive learning for visual representations',
];

function ModeBadge({ mode }) {
  const cfg = {
    llm:         { bg: 'bg-purple-100 text-purple-700 border-purple-300', icon: <Cpu size={12} />, label: 'LLM' },
    extractive:  { bg: 'bg-blue-100 text-blue-700 border-blue-300',       icon: <Layers size={12} />, label: 'Extractive' },
    'multi-hop': { bg: 'bg-emerald-100 text-emerald-700 border-emerald-300', icon: <Zap size={12} />, label: 'Multi-hop' },
  };
  const c = cfg[mode] ?? cfg.extractive;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border ${c.bg}`}>
      {c.icon} {c.label}
    </span>
  );
}

function EvidenceCard({ work }) {
  const tr = useT();
  const [expanded, setExpanded] = useState(false);
  const abstract = work.abstract || '';
  return (
    <div className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-xs">
      <div className="font-medium text-slate-700 line-clamp-2 mb-1">
        <Link to={`/works/${work.work_id}`} className="text-blue-700 hover:underline">
          {work.title || work.work_id}
        </Link>
      </div>
      <div className="flex items-center gap-2 text-slate-400 mb-1">
        {work.publication_year && <span>{work.publication_year}</span>}
        {work.journal && <span className="truncate max-w-[140px]">· {work.journal}</span>}
        {work.cited_by_count > 0 && <span className="text-amber-500">· {work.cited_by_count} {tr('pages.rag.cited', 'cited')}</span>}
        {work.doi && (
          <a href={`https://doi.org/${work.doi}`} target="_blank" rel="noreferrer" className="ml-auto hover:text-blue-500">
            <ExternalLink size={10} />
          </a>
        )}
      </div>
      {abstract && (
        <div>
          <p className="text-slate-500 leading-relaxed">
            {expanded ? abstract : abstract.slice(0, 120)}
            {abstract.length > 120 && !expanded && '…'}
          </p>
          {abstract.length > 120 && (
            <button className="text-blue-500 hover:underline mt-0.5" onClick={() => setExpanded((e) => !e)}>
              {expanded ? tr('pages.rag.less', 'less') : tr('pages.rag.more', 'more')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FollowUpChips({ userQuery, onAsk }) {
  const topic = userQuery.replace(/\b(what|how|why|when|who|which|tell me|explain)\b/gi, '').trim().slice(0, 40);
  const chips = [
    `What are the limitations of ${topic}?`,
    `Who are the key researchers in ${topic}?`,
    `What datasets are used for ${topic}?`,
  ];
  return (
    <div className="flex flex-wrap gap-1.5 mt-2 px-1">
      {chips.map((chip) => (
        <button
          key={chip}
          onClick={() => onAsk(chip)}
          className="px-2.5 py-1 text-xs rounded-full bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 border border-slate-200 hover:border-blue-300 transition-colors"
        >
          {chip}
        </button>
      ))}
    </div>
  );
}

function MessageBubble({ msg, streaming = false, onFollowUp }) {
  const tr = useT();
  const isUser = msg.role === 'user';
  const [showEvidence, setShowEvidence] = useState(false);
  const evidenceWorks = msg.evidence_works ?? [];
  const citations = msg.citations ?? [];

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} gap-2`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-0.5">
          <Cpu size={13} className="text-white" />
        </div>
      )}
      <div className={`max-w-[78%] space-y-1.5 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`px-4 py-3 rounded-2xl text-sm ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-sm'
            : 'bg-slate-100 text-slate-800 rounded-bl-sm'
        }`}>
          {isUser ? (
            <p>{msg.content}</p>
          ) : (
            <Markdown text={msg.content} streaming={streaming} />
          )}
        </div>

        {!isUser && (msg.mode || msg.latency_ms != null) && (
          <div className="flex items-center gap-2 px-1">
            {msg.mode && <ModeBadge mode={msg.mode} />}
            {msg.latency_ms != null && (
              <span className="text-xs text-slate-400">{Number(msg.latency_ms).toFixed(0)} ms</span>
            )}
          </div>
        )}

        {!isUser && citations.length > 0 && (
          <div className="flex flex-wrap gap-1 px-1">
            {citations.map((id) => <CitationChip key={id} id={id} />)}
          </div>
        )}

        {!isUser && evidenceWorks.length > 0 && (
          <div className="w-full px-1">
            <button
              onClick={() => setShowEvidence((s) => !s)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
            >
              {showEvidence ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {tr('pages.rag.evidence', 'Evidence')} ({evidenceWorks.length} {tr('pages.rag.papers', 'papers')})
            </button>
            {showEvidence && (
              <div className="mt-1.5 space-y-1.5">
                {evidenceWorks.map((w, i) => <EvidenceCard key={w.work_id ?? i} work={w} />)}
              </div>
            )}
          </div>
        )}

        {/* Follow-up chips (only on last non-streaming assistant message) */}
        {!isUser && !streaming && onFollowUp && msg.content && (
          <FollowUpChips userQuery={msg._userQuery || ''} onAsk={onFollowUp} />
        )}
      </div>
    </div>
  );
}

// ── Session list item ──────────────────────────────────────────────────────────
function SessionItem({ sess, active, onClick, onDelete }) {
  const tr = useT();
  return (
    <div
      className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
        active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
      }`}
      onClick={onClick}
    >
      <MessageSquare size={13} className="shrink-0" />
      <span className="flex-1 text-xs truncate">{sess.title || tr('pages.rag.untitled', 'Untitled')}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(sess.session_id); }}
        className={`opacity-0 group-hover:opacity-100 transition-opacity ${active ? 'text-blue-200 hover:text-white' : 'text-slate-400 hover:text-red-500'}`}
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function RagQA() {
  const tr = useT();
  const TPL_LABELS = {
    recent:     tr('pages.rag.tplRecent', 'Recent advances in…'),
    datasets:   tr('pages.rag.tplDatasets', 'Datasets used for…'),
    challenges: tr('pages.rag.tplChallenges', 'Key challenges in…'),
    methods:    tr('pages.rag.tplMethods', 'Main methods/approaches in…'),
    how:        tr('pages.rag.tplHow', 'How does … work?'),
    apps:       tr('pages.rag.tplApps', 'Applications of…'),
  };
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState('');
  const [useExtractive, setUseExtractive] = useState(false);
  const [useMultiHop, setUseMultiHop] = useState(false);
  const [llmAvail, setLlmAvail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [streamText, setStreamText] = useState('');
  const [concepts, setConcepts] = useState([]);
  const [tplId, setTplId] = useState('recent');
  const [tplConcept, setTplConcept] = useState('');
  const [showBuilder, setShowBuilder] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  useEffect(() => {
    api.health().then((h) => setLlmAvail(h.llm_available ?? false)).catch(() => setLlmAvail(false));
    api.listConversations().then(setSessions).catch(() => {});
    api.getTopConcepts(40).then((res) => {
      const arr = Array.isArray(res) ? res : (res?.concepts ?? []);
      const filtered = arr.filter((c) => !['Computer science', 'Mathematics', 'Philosophy', 'Engineering'].includes(c.concept_name));
      setConcepts(filtered);
      if (filtered[0]) setTplConcept(filtered[0].concept_name);
    }).catch(() => {});
  }, []);

  const builtQuestion = () => {
    const tpl = QUESTION_TEMPLATES.find((t) => t.id === tplId) ?? QUESTION_TEMPLATES[0];
    return tplConcept ? tpl.build(tplConcept) : '';
  };

  async function submitQuestion(text) {
    const qq = (text ?? '').trim();
    if (!qq || loading) return;
    setQuery('');
    let sess = activeSession;
    try {
      if (!sess) {
        sess = await api.createConversation(qq.slice(0, 60));
        setSessions((s) => [sess, ...s]);
        setActiveSession(sess);
      }
      await doAsk(sess.session_id, qq);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    // Scroll only the inner messages container — never use scrollIntoView here,
    // as it bubbles up and scrolls the outer <main>, hiding the page header.
    if (messages.length === 0 && !streamText) return;
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streamText]);

  async function newSession() {
    try {
      const sess = await api.createConversation('New Conversation');
      setSessions((s) => [sess, ...s]);
      setActiveSession(sess);
      setMessages([]);
    } catch (e) {
      setError(e.message);
    }
  }

  async function loadSession(sess) {
    setActiveSession(sess);
    setMessages([]);
    setError(null);
    try {
      const detail = await api.getConversation(sess.session_id);
      setMessages(detail.messages ?? []);
    } catch (e) {
      setError(e.message);
    }
  }

  async function deleteSession(sessionId) {
    try {
      await api.deleteConversation(sessionId);
      setSessions((s) => s.filter((x) => x.session_id !== sessionId));
      if (activeSession?.session_id === sessionId) {
        setActiveSession(null);
        setMessages([]);
      }
    } catch (e) {
      setError(e.message);
    }
  }

  async function sendMessage(e) {
    e?.preventDefault();
    const q = query.trim();
    if (!q || loading) return;
    if (!activeSession) {
      // Auto-create session
      try {
        const sess = await api.createConversation(q.slice(0, 60));
        setSessions((s) => [sess, ...s]);
        setActiveSession(sess);
        await doAsk(sess.session_id, q);
      } catch (err) {
        setError(err.message);
      }
      return;
    }
    await doAsk(activeSession.session_id, q);
  }

  async function doAsk(sessionId, q) {
    setLoading(true);
    setError(null);
    setStreamText('');
    setQuery('');

    const userMsg = { message_id: `tmp-u-${Date.now()}`, role: 'user', content: q, created_at: new Date().toISOString() };
    setMessages((m) => [...m, userMsg]);

    let finalEvent = {};
    let accumulated = '';

    try {
      for await (const event of streamConversationAsk(sessionId, q, {
        use_extractive_fallback: useExtractive || !llmAvail,
        multi_hop: useMultiHop && !useExtractive,
      })) {
        if (event.type === 'token') {
          accumulated += event.content;
          setStreamText(accumulated);
        } else if (event.type === 'done') {
          finalEvent = event;
        }
      }

      const assistantMsg = {
        message_id: `tmp-a-${Date.now()}`,
        role: 'assistant',
        content: accumulated || finalEvent.answer_text || '',
        citations: finalEvent.citations ?? [],
        evidence_works: finalEvent.evidence_works ?? [],
        hop_works: finalEvent.hop_works ?? [],
        mode: finalEvent.mode,
        latency_ms: finalEvent.latency_ms,
        created_at: new Date().toISOString(),
        _userQuery: q,
      };
      setMessages((m) => [...m, assistantMsg]);
      setStreamText('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 -mx-6 -my-6">
      {/* Session sidebar */}
      <div className="w-52 shrink-0 flex flex-col bg-white border-r border-slate-200">
        <div className="flex items-center justify-between px-3 py-3 border-b border-slate-100">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{tr('pages.rag.conversations', 'Conversations')}</span>
          <button
            onClick={newSession}
            className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            title={tr('pages.rag.newConversation', 'New conversation')}
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {sessions.length === 0 ? (
            <p className="text-xs text-slate-400 px-3 py-4 text-center">{tr('pages.rag.noConversations', 'No conversations yet')}</p>
          ) : sessions.map((sess) => (
            <SessionItem
              key={sess.session_id}
              sess={sess}
              active={activeSession?.session_id === sess.session_id}
              onClick={() => loadSession(sess)}
              onDelete={deleteSession}
            />
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="shrink-0 px-6 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-slate-900">
              {activeSession?.title || tr('pages.rag.headerTitle', 'Research Q&A')}
            </h1>
            {llmAvail === false && (
              <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                <Cpu size={10} /> {tr('pages.rag.llmUnavailable', 'llama.cpp not running — extractive mode active')}
              </p>
            )}
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => api.exportConversation(activeSession.session_id)}
              className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
            >
              {tr('pages.rag.export', 'Export')}
            </button>
          )}
        </div>

        {/* Messages */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && !loading && (
            <div className="max-w-2xl mx-auto py-8">
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-3">
                  <Sparkles size={22} className="text-white" />
                </div>
                <p className="text-base font-semibold text-slate-700 dark:text-slate-200">{tr('pages.rag.emptyTitle', 'Ask a research question')}</p>
                <p className="text-xs text-slate-400 mt-1">{tr('pages.rag.emptyDescription', 'Answers are grounded in the paper knowledge base with clickable citations.')}</p>
              </div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Lightbulb size={12} /> {tr('pages.rag.tryOneOfThese', 'Try one of these')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DEMO_QUESTIONS.map((dq) => (
                  <button
                    key={dq}
                    onClick={() => submitQuestion(dq)}
                    className="text-left p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-300 hover:bg-blue-50/40 dark:hover:bg-blue-900/20 transition-colors text-sm text-slate-700 dark:text-slate-300"
                  >
                    {dq}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, idx) => {
            const isLastAssistant = msg.role === 'assistant' && !loading &&
              messages.slice(idx + 1).every((m) => m.role === 'user');
            return (
              <MessageBubble
                key={msg.message_id}
                msg={msg}
                onFollowUp={isLastAssistant ? (chip) => { setQuery(chip); } : undefined}
              />
            );
          })}
          {loading && streamText && (
            <MessageBubble
              msg={{ role: 'assistant', content: streamText, message_id: '__streaming__' }}
              streaming
            />
          )}
          {loading && !streamText && (
            <div className="flex justify-start gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center">
                <Cpu size={13} className="text-white" />
              </div>
              <div className="px-4 py-3 bg-slate-100 rounded-2xl rounded-bl-sm">
                <Loader2 size={16} className="text-slate-400 animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Input */}
        <div data-tour="rag-input" className="shrink-0 px-6 py-4 border-t border-slate-200 bg-white">
          {/* Question builder */}
          <div className="mb-2">
            <button
              type="button"
              onClick={() => setShowBuilder((s) => !s)}
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700"
            >
              <Wand2 size={13} /> {tr('pages.rag.questionBuilder', 'Question builder')}
              {showBuilder ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {showBuilder && (
              <div className="mt-2 flex flex-wrap items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <select
                  value={tplId}
                  onChange={(e) => setTplId(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {QUESTION_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>{TPL_LABELS[t.id] ?? t.label}</option>
                  ))}
                </select>
                <select
                  value={tplConcept}
                  onChange={(e) => setTplConcept(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-48"
                >
                  {concepts.length === 0 && <option value="">{tr('pages.rag.loadingConcepts', 'Loading concepts…')}</option>}
                  {concepts.map((c) => (
                    <option key={c.concept_name} value={c.concept_name}>{c.concept_name}</option>
                  ))}
                </select>
                <span className="text-xs text-slate-400 flex-1 min-w-0 truncate italic">
                  {builtQuestion() || tr('pages.rag.pickTopic', 'Pick a topic…')}
                </span>
                <button
                  type="button"
                  onClick={() => setQuery(builtQuestion())}
                  disabled={!builtQuestion()}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-40 transition-colors"
                >
                  {tr('pages.rag.insert', 'Insert')}
                </button>
                <button
                  type="button"
                  onClick={() => submitQuestion(builtQuestion())}
                  disabled={!builtQuestion() || loading}
                  className="px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center gap-1"
                >
                  <Send size={11} /> {tr('pages.rag.ask', 'Ask')}
                </button>
              </div>
            )}
          </div>
          <form onSubmit={sendMessage} className="flex gap-2">
            <div className="flex-1 space-y-2">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder={tr('pages.rag.inputPlaceholder', 'Ask a research question…')}
                rows={2}
                className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useExtractive}
                    onChange={(e) => setUseExtractive(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  {tr('pages.rag.extractive', 'Extractive')}
                </label>
                {llmAvail && (
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useMultiHop}
                      disabled={useExtractive}
                      onChange={(e) => setUseMultiHop(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-40"
                    />
                    <span className={useExtractive ? 'opacity-40' : ''}>{tr('pages.rag.multiHop', 'Multi-hop')}</span>
                  </label>
                )}
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="self-end px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl
                         hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors flex items-center gap-1.5"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
