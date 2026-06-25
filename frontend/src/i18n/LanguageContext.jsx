import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { zh } from './zh.js';
import { en } from './en.js';

const DICTS = { zh, en };
const LanguageContext = createContext(null);

function resolve(dict, key) {
  // Supports dotted keys e.g. "nav.dashboard"
  return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), dict);
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('lang');
      if (saved === 'zh' || saved === 'en') return saved;
    }
    return 'zh';
  });

  const setLanguage = useCallback((l) => {
    setLang(l);
    try { localStorage.setItem('lang', l); } catch { /* ignore */ }
  }, []);

  const toggle = useCallback(() => {
    setLanguage(lang === 'zh' ? 'en' : 'zh');
  }, [lang, setLanguage]);

  // t(key, fallback?) — looks up current language, then English, then the key.
  const t = useCallback((key, fallback) => {
    const v = resolve(DICTS[lang], key);
    if (v != null) return v;
    const enV = resolve(DICTS.en, key);
    if (enV != null) return enV;
    return fallback ?? key;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLanguage, toggle, t }), [lang, setLanguage, toggle, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used within LanguageProvider');
  return ctx;
}

// Convenience hook returning just the translator.
export function useT() {
  return useLang().t;
}
