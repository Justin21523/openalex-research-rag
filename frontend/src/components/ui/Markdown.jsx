import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ExternalLink } from 'lucide-react';

// ── Citation chip — links to internal WorkDetail ───────────────────────────────
export function CitationChip({ id }) {
  return (
    <Link
      to={`/works/${id}`}
      className="inline-flex items-center px-1.5 py-0.5 text-xs font-mono font-semibold
                 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300
                 border border-amber-300 dark:border-amber-700
                 hover:bg-amber-200 dark:hover:bg-amber-900/70 transition-colors mx-0.5 no-underline align-baseline"
    >
      [{id}]
    </Link>
  );
}

// Turn bare citation markers like [W123456789] into markdown links so they flow
// through the renderer and become clickable chips.
function injectCitations(text) {
  return text.replace(/\[(W\d+)\]/g, '[$1](work:$1)');
}

const COMPONENTS = {
  a({ href, children, ...props }) {
    if (href && href.startsWith('work:')) {
      return <CitationChip id={href.slice(5)} />;
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5"
        {...props}
      >
        {children}
        <ExternalLink size={11} className="inline shrink-0" />
      </a>
    );
  },
  p({ children }) {
    return <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>;
  },
  h1({ children }) {
    return <h1 className="text-lg font-bold text-slate-900 dark:text-white mt-4 mb-2 first:mt-0">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="text-base font-bold text-slate-900 dark:text-white mt-4 mb-2 first:mt-0">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="text-sm font-semibold text-slate-900 dark:text-white mt-3 mb-1.5 first:mt-0">{children}</h3>;
  },
  ul({ children }) {
    return <ul className="list-disc pl-5 mb-3 space-y-1 marker:text-slate-400">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="list-decimal pl-5 mb-3 space-y-1 marker:text-slate-400">{children}</ol>;
  },
  li({ children }) {
    return <li className="leading-relaxed">{children}</li>;
  },
  strong({ children }) {
    return <strong className="font-semibold text-slate-900 dark:text-white">{children}</strong>;
  },
  em({ children }) {
    return <em className="italic">{children}</em>;
  },
  blockquote({ children }) {
    return (
      <blockquote className="border-l-3 border-slate-300 dark:border-slate-600 pl-3 italic text-slate-600 dark:text-slate-400 my-3">
        {children}
      </blockquote>
    );
  },
  code({ inline, children }) {
    if (inline) {
      return (
        <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-[0.85em] font-mono text-pink-600 dark:text-pink-400">
          {children}
        </code>
      );
    }
    return <code className="font-mono text-xs">{children}</code>;
  },
  pre({ children }) {
    return (
      <pre className="bg-slate-900 dark:bg-slate-950 text-slate-100 rounded-lg p-3 overflow-x-auto text-xs my-3 leading-relaxed">
        {children}
      </pre>
    );
  },
  table({ children }) {
    return (
      <div className="overflow-x-auto my-3">
        <table className="min-w-full text-xs border-collapse">{children}</table>
      </div>
    );
  },
  thead({ children }) {
    return <thead className="border-b border-slate-200 dark:border-slate-600">{children}</thead>;
  },
  th({ children }) {
    return <th className="px-2.5 py-1.5 text-left font-semibold text-slate-700 dark:text-slate-300">{children}</th>;
  },
  td({ children }) {
    return <td className="px-2.5 py-1.5 border-t border-slate-100 dark:border-slate-700/60">{children}</td>;
  },
  a_fallback: null,
  hr() {
    return <hr className="my-4 border-slate-200 dark:border-slate-700" />;
  },
};

/**
 * Render LLM / markdown text with GFM support and clickable [Wxxxx] citation chips.
 * Pass `streaming` to show a blinking cursor at the end.
 */
export default function Markdown({ text, streaming = false, className = '' }) {
  if (!text && !streaming) return null;
  return (
    <div className={`text-sm text-slate-800 dark:text-slate-200 ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {injectCitations(text || '')}
      </ReactMarkdown>
      {streaming && (
        <span className="inline-block w-0.5 h-4 bg-slate-600 dark:bg-slate-300 align-middle ml-0.5 animate-pulse" />
      )}
    </div>
  );
}
