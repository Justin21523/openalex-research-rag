import { useState, useEffect } from 'react';
import { X, ExternalLink, Loader2 } from 'lucide-react';
import { api, safeParseJSON } from '../api/client.js';

export default function CompareModal({ workIds, onClose }) {
  const [works, setWorks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedAbstracts, setExpandedAbstracts] = useState({});

  useEffect(() => {
    async function load() {
      try {
        const data = await api.compareWorks(workIds);
        setWorks(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [workIds]);

  if (!workIds.length) return null;

  const cols = works.length || workIds.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 overflow-auto">
      <div className="w-full max-w-7xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Comparing {cols} Papers
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={32} className="animate-spin text-blue-500" />
          </div>
        )}

        {error && (
          <div className="p-6 text-red-500 text-sm">{error}</div>
        )}

        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <td className="px-4 py-3 font-semibold text-slate-500 dark:text-slate-400 w-28 shrink-0">Field</td>
                  {works.map((w) => (
                    <th key={w.work_id} className="px-4 py-3 text-left font-bold text-slate-900 dark:text-white min-w-64">
                      <a
                        href={`/works/${w.work_id}`}
                        className="hover:text-blue-600 dark:hover:text-blue-400 line-clamp-3"
                      >
                        {w.title || w.work_id}
                      </a>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                <CompareRow label="Year" works={works} field="publication_year" />
                <CompareRow label="Citations" works={works} field="cited_by_count" />
                <CompareRow label="Journal" works={works} field="journal" />
                <CompareRow label="Type" works={works} field="type" />
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 align-top">Concepts</td>
                  {works.map((w) => {
                    const concepts = safeParseJSON(w.concepts, []);
                    return (
                      <td key={w.work_id} className="px-4 py-3 align-top">
                        <div className="flex flex-wrap gap-1">
                          {concepts.slice(0, 5).map((c) => (
                            <span key={c.id || c.display_name} className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs">
                              {c.display_name}
                            </span>
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 align-top">Abstract</td>
                  {works.map((w) => {
                    const expanded = expandedAbstracts[w.work_id];
                    const abstract = w.abstract || '';
                    const short = abstract.slice(0, 200);
                    return (
                      <td key={w.work_id} className="px-4 py-3 align-top text-slate-700 dark:text-slate-300 leading-relaxed">
                        {expanded ? abstract : short}
                        {abstract.length > 200 && (
                          <button
                            className="ml-1 text-blue-500 text-xs hover:underline"
                            onClick={() => setExpandedAbstracts((p) => ({ ...p, [w.work_id]: !p[w.work_id] }))}
                          >
                            {expanded ? 'less' : '…more'}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">DOI</td>
                  {works.map((w) => (
                    <td key={w.work_id} className="px-4 py-3">
                      {w.doi ? (
                        <a
                          href={`https://doi.org/${w.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-500 hover:underline text-xs"
                        >
                          <ExternalLink size={12} /> {w.doi.slice(0, 30)}…
                        </a>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function CompareRow({ label, works, field }) {
  return (
    <tr>
      <td className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">{label}</td>
      {works.map((w) => (
        <td key={w.work_id} className="px-4 py-3 text-slate-900 dark:text-white">
          {w[field] ?? <span className="text-slate-400">—</span>}
        </td>
      ))}
    </tr>
  );
}
