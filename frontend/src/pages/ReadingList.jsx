import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookMarked, Trash2, ExternalLink, CheckCircle, Clock, BookOpen, RefreshCw, X } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../api/client.js';
import { useT } from '../i18n/LanguageContext.jsx';

const STATUS_TABS = [
  { key: null,       label: 'All',      tk: 'tabAll',     icon: BookMarked },
  { key: 'unread',   label: 'Unread',   tk: 'tabUnread',  icon: BookOpen   },
  { key: 'reading',  label: 'Reading',  tk: 'tabReading', icon: Clock      },
  { key: 'done',     label: 'Done',     tk: 'tabDone',    icon: CheckCircle},
];

const STATUS_COLORS = {
  unread:  'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  reading: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  done:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
};

const PIE_COLORS = { unread: '#94a3b8', reading: '#3b82f6', done: '#10b981' };

export default function ReadingList() {
  const [activeTab, setActiveTab] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const tr = useT();
  const STATUS_LABELS = {
    unread:  tr('pages.readingList.statusUnread', 'Unread'),
    reading: tr('pages.readingList.statusReading', 'Reading'),
    done:    tr('pages.readingList.statusDone', 'Done'),
  };

  async function load() {
    setLoading(true);
    try {
      const data = await api.getReadingList(activeTab);
      setItems(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [activeTab]);

  async function updateStatus(workId, status) {
    await api.updateReadingStatus(workId, status);
    setItems((prev) => prev.map((it) => it.work_id === workId ? { ...it, status } : it));
  }

  async function remove(workId) {
    await api.removeFromReadingList(workId);
    setItems((prev) => prev.filter((it) => it.work_id !== workId));
  }

  const toggleSelect = (workId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(workId)) next.delete(workId); else next.add(workId);
      return next;
    });
  };

  const bulkStatus = async (status) => {
    await Promise.all([...selectedIds].map((id) => api.updateReadingStatus(id, status)));
    setItems((prev) => prev.map((it) => selectedIds.has(it.work_id) ? { ...it, status } : it));
    setSelectedIds(new Set());
  };

  const bulkRemove = async () => {
    await Promise.all([...selectedIds].map((id) => api.removeFromReadingList(id)));
    setItems((prev) => prev.filter((it) => !selectedIds.has(it.work_id)));
    setSelectedIds(new Set());
  };

  const counts = items.reduce((acc, it) => ({ ...acc, [it.status]: (acc[it.status] || 0) + 1 }), {});
  const allCounts = { unread: 0, reading: 0, done: 0 };
  items.forEach((it) => { if (it.status in allCounts) allCounts[it.status]++; });
  const pieData = Object.entries(allCounts)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: k, value: v, fill: PIE_COLORS[k] }));

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header + Donut chart */}
      <div data-tour="reading-list" className="flex items-start gap-6 mb-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-4">
            <BookMarked size={24} className="text-blue-600 dark:text-blue-400" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{tr('pages.readingList.title', 'Reading List')}</h1>
            <span className="ml-auto text-sm text-slate-500">{items.length} {tr('pages.readingList.papers', 'papers')}</span>
            <button onClick={load} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              <RefreshCw size={14} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        {items.length > 0 && pieData.length > 0 && (
          <div className="flex items-center gap-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-3 shrink-0">
            <ResponsiveContainer width={80} height={80}>
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={22} outerRadius={36} strokeWidth={0}>
                  {pieData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1 text-xs">
              {Object.entries(allCounts).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[k] }} />
                  <span className="text-slate-600 dark:text-slate-400 capitalize">{STATUS_LABELS[k]}</span>
                  <span className="font-bold text-slate-900 dark:text-white ml-1">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        {STATUS_TABS.map(({ key, label, tk, icon: Icon }) => (
          <button
            key={String(key)}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Icon size={14} />
            {tr(`pages.readingList.${tk}`, label)}
            {key && counts[key] ? (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs">
                {counts[key]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-12 text-slate-400">{tr('pages.readingList.loading', 'Loading…')}</div>
      )}

      {!loading && items.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <BookMarked size={40} className="mx-auto mb-3 opacity-30" />
          <p>{tr('pages.readingList.emptyTitle', 'No papers in this list yet.')}</p>
          <p className="text-sm mt-1">{tr('pages.readingList.emptyHint', 'Visit a paper and click "Add to Reading List".')}</p>
        </div>
      )}

      {items.length > 0 && (
        <div className="flex items-center gap-2 mb-3 text-xs">
          <button
            onClick={() => setSelectedIds(selectedIds.size === items.length ? new Set() : new Set(items.map((i) => i.work_id)))}
            className="text-slate-500 hover:text-blue-600 transition-colors"
          >
            {selectedIds.size === items.length ? tr('pages.readingList.deselectAll', 'Deselect all') : tr('pages.readingList.selectAll', 'Select all')}
          </button>
          {selectedIds.size > 0 && (
            <span className="text-slate-400">{selectedIds.size} {tr('pages.readingList.selected', 'selected')}</span>
          )}
        </div>
      )}

      <div className="space-y-3 pb-20">
        {items.map((item) => (
          <div
            key={item.work_id}
            className={`bg-white dark:bg-slate-800 rounded-xl border p-4 flex gap-3 transition-colors ${
              selectedIds.has(item.work_id)
                ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/20'
                : 'border-slate-200 dark:border-slate-700'
            }`}
          >
            {/* Checkbox */}
            <div className="flex items-start pt-0.5">
              <input
                type="checkbox"
                checked={selectedIds.has(item.work_id)}
                onChange={() => toggleSelect(item.work_id)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
            </div>

            <div className="flex-1 min-w-0">
              <button
                onClick={() => navigate(`/works/${item.work_id}`)}
                className="text-sm font-semibold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 text-left line-clamp-2"
              >
                {item.title || item.work_id}
              </button>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {item.publication_year && (
                  <span className="text-xs text-slate-500">{item.publication_year}</span>
                )}
                {item.journal && (
                  <span className="text-xs text-slate-400 truncate max-w-xs">{item.journal}</span>
                )}
                {item.cited_by_count > 0 && (
                  <span className="text-xs text-amber-600">{item.cited_by_count} {tr('pages.readingList.cited', 'cited')}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <select
                value={item.status}
                onChange={(e) => updateStatus(item.work_id, e.target.value)}
                className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer ${STATUS_COLORS[item.status]}`}
              >
                <option value="unread">{STATUS_LABELS.unread}</option>
                <option value="reading">{STATUS_LABELS.reading}</option>
                <option value="done">{STATUS_LABELS.done}</option>
              </select>

              {item.doi && (
                <a
                  href={`https://doi.org/${item.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <ExternalLink size={14} />
                </a>
              )}

              <button
                onClick={() => remove(item.work_id)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Bulk action floating bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3
                        bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl">
          <span className="text-sm font-medium">{selectedIds.size} {tr('pages.readingList.selected', 'selected')}</span>
          {['unread', 'reading', 'done'].map((s) => (
            <button
              key={s}
              onClick={() => bulkStatus(s)}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-medium transition-colors capitalize"
            >
              {tr('pages.readingList.mark', 'Mark')} {STATUS_LABELS[s]}
            </button>
          ))}
          <button
            onClick={bulkRemove}
            className="px-3 py-1.5 bg-red-700 hover:bg-red-600 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
          >
            <Trash2 size={11} /> {tr('pages.readingList.remove', 'Remove')}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-1 text-slate-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
