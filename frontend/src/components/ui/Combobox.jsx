import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Loader2, ChevronDown } from 'lucide-react';

/**
 * Searchable combobox: shows a preset "top" list when empty/focused, and live
 * search results while typing. Selecting an option calls onSelect(option).
 * Pressing Enter with free text calls onSubmit(text) (open-ended fallback).
 *
 * Props:
 *   placeholder   — input placeholder
 *   fetchTop()    — async () => option[]   (shown when input is empty)
 *   fetchSearch(q)— async (q) => option[]  (shown while typing)
 *   getKey(opt)   — unique key for an option
 *   renderOption(opt) — JSX for an option row
 *   onSelect(opt) — called when an option is chosen
 *   onSubmit(text)— called on Enter with raw text (optional)
 *   topLabel      — heading shown above the preset list (default "Popular")
 */
export default function Combobox({
  placeholder = 'Search…',
  fetchTop,
  fetchSearch,
  getKey,
  renderOption,
  onSelect,
  onSubmit,
  topLabel = 'Popular',
  autoFocus = false,
}) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const [showingTop, setShowingTop] = useState(true);
  const boxRef = useRef(null);
  const debounceRef = useRef(null);
  const reqRef = useRef(0);

  const loadTop = useCallback(async () => {
    if (!fetchTop) { setOptions([]); return; }
    setLoading(true);
    setShowingTop(true);
    const rid = ++reqRef.current;
    try {
      const res = await fetchTop();
      if (rid === reqRef.current) setOptions(Array.isArray(res) ? res : []);
    } catch {
      if (rid === reqRef.current) setOptions([]);
    } finally {
      if (rid === reqRef.current) setLoading(false);
    }
  }, [fetchTop]);

  const loadSearch = useCallback(async (q) => {
    setLoading(true);
    setShowingTop(false);
    const rid = ++reqRef.current;
    try {
      const res = await fetchSearch(q);
      if (rid === reqRef.current) setOptions(Array.isArray(res) ? res : []);
    } catch {
      if (rid === reqRef.current) setOptions([]);
    } finally {
      if (rid === reqRef.current) setLoading(false);
    }
  }, [fetchSearch]);

  // Debounced reaction to typing
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) {
      loadTop();
      return;
    }
    debounceRef.current = setTimeout(() => loadSearch(text.trim()), 250);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [text, open, loadTop, loadSearch]);

  // Close on outside click
  useEffect(() => {
    function onDoc(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const choose = (opt) => {
    setOpen(false);
    setText('');
    onSelect?.(opt);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, options.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0 && options[active]) choose(options[active]);
      else if (text.trim() && onSubmit) { setOpen(false); onSubmit(text.trim()); }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={text}
          autoFocus={autoFocus}
          onChange={(e) => { setText(e.target.value); setActive(-1); }}
          onFocus={() => { setOpen(true); if (!text.trim()) loadTop(); }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <ChevronDown
          size={15}
          className={`absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-80 overflow-y-auto">
          <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5 sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
            {loading ? <Loader2 size={11} className="animate-spin" /> : null}
            {showingTop ? topLabel : `Results for “${text.trim()}”`}
          </div>
          {options.length === 0 && !loading ? (
            <div className="px-3 py-3 text-sm text-slate-400">
              {showingTop ? 'No suggestions.' : 'No matches — press Enter to search anyway.'}
            </div>
          ) : (
            options.map((opt, i) => (
              <button
                key={getKey(opt)}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(opt)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  active === i ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
              >
                {renderOption(opt)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
