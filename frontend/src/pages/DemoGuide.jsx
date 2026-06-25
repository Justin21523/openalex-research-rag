import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart3, BookOpen, Brain, Database, FileUp, GitMerge, MessageSquareQuote,
  Network, Play, Search, Sparkles, Workflow, Zap,
} from 'lucide-react';
import { useT } from '../i18n/LanguageContext.jsx';
import { useTour } from '../tour/TourContext.jsx';

const JOURNEY = [
  { icon: Database, key: 'raw', color: 'bg-sky-500' },
  { icon: Sparkles, key: 'clean', color: 'bg-violet-500' },
  { icon: Search, key: 'bm25', color: 'bg-amber-500' },
  { icon: Brain, key: 'vector', color: 'bg-purple-600' },
  { icon: GitMerge, key: 'rrf', color: 'bg-teal-600' },
  { icon: BookOpen, key: 'context', color: 'bg-orange-500' },
  { icon: MessageSquareQuote, key: 'answer', color: 'bg-emerald-600' },
];

const FEATURE_LINKS = [
  { to: '/data-story', icon: Workflow, key: 'dataStory' },
  { to: '/playground', icon: FileUp, key: 'playground' },
  { to: '/topics', icon: BarChart3, key: 'topics' },
  { to: '/authors', icon: Network, key: 'authors' },
];

export default function DemoGuide() {
  const t = useT();
  const { start } = useTour();

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <section data-tour="demo-guide" className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-6 items-stretch mb-8">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 overflow-hidden relative">
          <div className="absolute right-6 top-6 w-24 h-24 rounded-full bg-blue-100 dark:bg-blue-950/40 blur-2xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-semibold mb-4">
              <Sparkles size={14} />
              {t('pages.demoGuide.badge')}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white mb-3">
              {t('pages.demoGuide.title')}
            </h1>
            <p className="text-sm leading-7 text-slate-600 dark:text-slate-300 max-w-2xl">
              {t('pages.demoGuide.subtitle')}
            </p>
            <div className="flex flex-wrap gap-2 mt-6">
              <button
                onClick={start}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                <Play size={15} /> {t('pages.demoGuide.startTour')}
              </button>
              <Link
                to="/data-story"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:border-blue-300 transition-colors"
              >
                <Workflow size={15} /> {t('pages.demoGuide.openJourney')}
              </Link>
            </div>
          </div>
        </div>

        <div data-tour="demo-journey" className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-950 p-5 text-white overflow-hidden">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-blue-300 font-semibold">{t('pages.demoGuide.flowKicker')}</p>
              <h2 className="text-lg font-bold">{t('pages.demoGuide.flowTitle')}</h2>
            </div>
            <Zap size={18} className="text-amber-300" />
          </div>
          <div className="relative">
            <div className="absolute left-5 right-5 top-6 h-px bg-gradient-to-r from-sky-400 via-purple-400 to-emerald-400 opacity-50" />
            <div className="grid grid-cols-7 gap-2 relative">
              {JOURNEY.map(({ icon: Icon, key, color }, i) => (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="flex flex-col items-center gap-2"
                >
                  <motion.div
                    animate={{ y: [0, -5, 0], scale: [1, 1.05, 1] }}
                    transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.18 }}
                    className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center shadow-lg`}
                  >
                    <Icon size={18} />
                  </motion.div>
                  <span className="text-[10px] leading-tight text-center text-slate-300">{t(`pages.demoGuide.flow.${key}`)}</span>
                </motion.div>
              ))}
            </div>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2">
            {['works', 'vectors', 'llm'].map((key) => (
              <div key={key} className="rounded-xl bg-white/10 border border-white/10 px-3 py-2">
                <p className="text-lg font-bold">{t(`pages.demoGuide.stats.${key}.value`)}</p>
                <p className="text-[11px] text-slate-300">{t(`pages.demoGuide.stats.${key}.label`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {FEATURE_LINKS.map(({ to, icon: Icon, key }) => (
          <Link
            key={key}
            to={to}
            className="group rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/40">
              <Icon size={18} className="text-blue-600 dark:text-blue-300" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">{t(`pages.demoGuide.cards.${key}.title`)}</h3>
            <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">{t(`pages.demoGuide.cards.${key}.body`)}</p>
          </Link>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-3">{t('pages.demoGuide.interviewerTitle')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {['engineering', 'explainability', 'demo'].map((key) => (
            <div key={key} className="rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 p-4">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">{t(`pages.demoGuide.points.${key}.title`)}</p>
              <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">{t(`pages.demoGuide.points.${key}.body`)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
