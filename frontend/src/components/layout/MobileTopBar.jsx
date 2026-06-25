import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Menu, X, Home, Search, GitBranch, TrendingUp, MessageSquare, FlaskConical, Activity } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext.jsx';

const NAV = [
  { to: '/dashboard', icon: <Home size={16} />, key: 'nav.dashboard' },
  { to: '/search', icon: <Search size={16} />, key: 'nav.search' },
  { to: '/rag', icon: <MessageSquare size={16} />, key: 'nav.rag' },
  { to: '/pipeline', icon: <Activity size={16} />, key: 'nav.pipeline' },
  { to: '/citations', icon: <GitBranch size={16} />, key: 'nav.citations' },
  { to: '/topics', icon: <TrendingUp size={16} />, key: 'nav.topics' },
  { to: '/playground', icon: <FlaskConical size={16} />, key: 'nav.playground' },
];

export default function MobileTopBar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { t } = useLang();

  return (
    <>
      <header className="lg:hidden sticky top-0 z-40 bg-slate-900 border-b border-slate-700 flex items-center px-4 py-3 gap-3">
        <div className="flex items-center gap-2 flex-1">
          <BookOpen size={20} className="text-blue-400 shrink-0" />
          <span className="text-sm font-bold text-white">OpenAlex RAG</span>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 transition-colors"
        >
          <Menu size={20} />
        </button>
      </header>

      {/* Overlay sidebar */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <nav
            className="absolute left-0 top-0 bottom-0 w-64 bg-slate-900 shadow-2xl flex flex-col p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <BookOpen size={18} className="text-blue-400" />
                <span className="text-sm font-bold text-white">OpenAlex RAG</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-0.5">
              {NAV.map(({ to, icon, key }) => {
                const active = location.pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      active
                        ? 'bg-blue-600 text-white font-medium'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {icon}
                    {t(key)}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
