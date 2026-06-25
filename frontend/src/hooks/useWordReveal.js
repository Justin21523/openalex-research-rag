import { useState, useEffect } from 'react';

/**
 * Progressively reveal `text` word-by-word on a timer (typewriter-ish).
 * Resets and replays whenever `text` changes. Returns the revealed substring.
 */
export function useWordReveal(text, delayMs = 40) {
  const [words, setWords] = useState([]);
  useEffect(() => {
    if (!text) { setWords([]); return; }
    const all = text.split(' ');
    setWords([]);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setWords(all.slice(0, i));
      if (i >= all.length) clearInterval(id);
    }, delayMs);
    return () => clearInterval(id);
  }, [text, delayMs]);
  return words.join(' ');
}

export default useWordReveal;
