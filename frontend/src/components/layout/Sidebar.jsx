import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Search, Users, GitBranch, TrendingUp, MessageSquare,
  BookOpen, BookMarked, Activity, ChevronLeft, ChevronRight, Wifi, WifiOff, Workflow, FlaskConical,
  Moon, Sun, Database, FileText, BarChart2, Zap, LayoutDashboard, Building2, Calendar, Languages, Sparkles,
} from 'lucide-react';
import { api } from '../../api/client.js';
import { useLang } from '../../i18n/LanguageContext.jsx';

const NAV = [
  { to: '/dashboard',    icon: LayoutDashboard, key: 'nav.dashboard'        },
  { to: '/',             icon: Search,          key: 'nav.search'           },
  { to: '/timeline',     icon: Calendar,        key: 'nav.timeline'         },
  { to: '/authors',      icon: Users,           key: 'nav.authors'          },
  { to: '/institutions', icon: Building2,       key: 'nav.institutions'     },
  { to: '/citations',    icon: GitBranch,       key: 'nav.citations'        },
  { to: '/topics',       icon: TrendingUp,      key: 'nav.topics'           },
  { to: '/journals',     icon: BarChart2,       key: 'nav.journals'         },
  { to: '/velocity',     icon: Zap,             key: 'nav.velocity'         },
  { to: '/rag',          icon: MessageSquare,   key: 'nav.rag'              },
  { to: '/reading-list',      icon: BookMarked, key: 'nav.readingList'      },
  { to: '/literature-review', icon: FileText,   key: 'nav.literatureReview' },
  { to: '/analytics',         icon: Activity,   key: 'nav.analytics'        },
  { to: '/pipeline',          icon: Workflow,   key: 'nav.pipeline'         },
  { to: '/data-story',        icon: Sparkles,   key: 'nav.dataStory'        },
  { to: '/playground',        icon: FlaskConical, key: 'nav.playground'     },
  { to: '/ingest',            icon: Database,   key: 'nav.ingest'           },
];

function useDarkMode() {
  const [dark, setDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );

  function toggle() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    setDark(isDark);
  }

  return [dark, toggle];
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [health, setHealth] = useState(null);
  const [dark, toggleDark] = useDarkMode();
  const { t, lang, toggle: toggleLang } = useLang();

  useEffect(() => {
    api.health()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  return (
    <aside
      className={`hidden lg:flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-200 shrink-0 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-slate-800 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
          <BookOpen size={16} className="text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm leading-tight truncate">{t('brand.title')}</p>
            <p className="text-slate-500 text-xs">{t('brand.subtitle')}</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {NAV.map(({ to, icon: Icon, key }) => {
          const label = t(key);
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              data-tour={`nav-${to === '/' ? 'search' : to.slice(1)}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                } ${collapsed ? 'justify-center' : ''}`
              }
              title={collapsed ? label : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Status + controls */}
      <div className="px-2 py-4 border-t border-slate-800 space-y-2">
        {!collapsed && health && (
          <div className="px-3 py-2 rounded-lg bg-slate-800 text-xs">
            <div className="flex items-center gap-1.5 text-emerald-400 mb-1">
              <Activity size={12} />
              <span className="font-medium">{t('sidebar.apiOnline')}</span>
            </div>
            <p className="text-slate-400">{health.works_count?.toLocaleString()} {t('sidebar.works')}</p>
            <p className="text-slate-400">{health.chromadb_count?.toLocaleString()} {t('sidebar.vectors')}</p>
          </div>
        )}
        {!collapsed && !health && (
          <div className="px-3 py-2 rounded-lg bg-slate-800 text-xs flex items-center gap-1.5 text-red-400">
            <WifiOff size={12} />
            <span>{t('sidebar.apiOffline')}</span>
          </div>
        )}

        {/* Language toggle */}
        <button
          onClick={toggleLang}
          title={t('sidebar.language')}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-blue-300 hover:bg-slate-800 text-xs transition-colors"
        >
          <Languages size={14} />
          {!collapsed && <span>{lang === 'zh' ? 'English' : '中文'}</span>}
        </button>

        {/* Dark mode toggle */}
        <button
          onClick={toggleDark}
          title={dark ? t('sidebar.lightMode') : t('sidebar.darkMode')}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-yellow-300 hover:bg-slate-800 text-xs transition-colors"
        >
          {dark ? <Sun size={14} /> : <Moon size={14} />}
          {!collapsed && <span>{dark ? t('sidebar.lightMode') : t('sidebar.darkMode')}</span>}
        </button>

        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 text-xs transition-colors"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          {!collapsed && <span>{t('sidebar.collapse')}</span>}
        </button>
      </div>
    </aside>
  );
}
