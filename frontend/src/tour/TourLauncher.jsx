import { motion } from 'framer-motion';
import { Compass } from 'lucide-react';
import { useTour } from './TourContext.jsx';
import { useT } from '../i18n/LanguageContext.jsx';

// App-like floating button that starts the guided tour. Hidden while the tour runs.
export default function TourLauncher() {
  const { active, start } = useTour();
  const t = useT();
  if (active) return null;

  return (
    <motion.button
      onClick={start}
      title={t('tour.launcher')}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.95 }}
      className="fixed bottom-6 right-6 z-[90] flex items-center gap-2 pl-3 pr-4 py-3
                 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 text-white
                 shadow-2xl shadow-blue-600/30"
    >
      {/* pulsing halo */}
      <span className="absolute inset-0 rounded-full bg-blue-500/40 animate-ping" style={{ animationDuration: '2.4s' }} />
      <Compass size={18} className="relative shrink-0" />
      <span className="relative text-sm font-semibold whitespace-nowrap">{t('tour.launcher')}</span>
    </motion.button>
  );
}
