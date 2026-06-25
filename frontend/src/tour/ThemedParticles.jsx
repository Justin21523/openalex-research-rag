import { motion } from 'framer-motion';

// Themed "performance" particles that play around the spotlighted element.
// Each theme renders ~10–14 framer-motion elements orbiting / drifting around
// the anchor rect, echoing the StageAura visual language. Purely decorative.

const THEMES = {
  // Rising numbers/dots — overview/dashboard
  overview: { glyphs: ['◆', '●', '▲', '＋'], colors: ['#60a5fa', '#a78bfa', '#34d399'] },
  // Search — magnifier sweep + token chips
  search: { glyphs: ['🔍', 'the', 'BM25', '◇', '●'], colors: ['#3b82f6', '#0ea5e9'] },
  // Graph — nodes + links
  graph: { glyphs: ['●', '◯', '─', '╱', '╲'], colors: ['#8b5cf6', '#22d3ee', '#f59e0b'] },
  // Trends — rising bars / line dots
  trends: { glyphs: ['▮', '▯', '╱', '●'], colors: ['#10b981', '#3b82f6'] },
  // RAG — floating citation brackets
  rag: { glyphs: ['[W…]', '“ ”', '●', '✦'], colors: ['#f59e0b', '#d97706'] },
  // Data — flowing data dots + JSON keys
  data: { glyphs: ['{ }', '"id"', '●', '0', '1'], colors: ['#0ea5e9', '#14b8a6', '#a78bfa'] },
  // Reading list — bookmarks
  list: { glyphs: ['🔖', '●', '✦'], colors: ['#3b82f6', '#10b981'] },
  // Analytics — pulsing chart dots
  analytics: { glyphs: ['▮', '●', '％', '✦'], colors: ['#3b82f6', '#8b5cf6', '#10b981'] },
};

export default function ThemedParticles({ rect, theme = 'overview' }) {
  const cfg = THEMES[theme] ?? THEMES.overview;
  // Center: around the anchor if known, else screen center.
  const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
  const rx = rect ? rect.width / 2 + 40 : 220;
  const ry = rect ? rect.height / 2 + 40 : 160;

  const count = 13;
  const items = Array.from({ length: count });

  return (
    <div className="pointer-events-none fixed inset-0 z-[101] select-none overflow-hidden">
      {items.map((_, i) => {
        const angle = (i / count) * Math.PI * 2 + (i % 2 ? 0.3 : 0);
        const x = cx + Math.cos(angle) * rx;
        const y = cy + Math.sin(angle) * ry;
        const glyph = cfg.glyphs[i % cfg.glyphs.length];
        const color = cfg.colors[i % cfg.colors.length];
        const isText = glyph.length > 1;
        // drift outward then back, fading in/out — staggered
        const driftX = Math.cos(angle) * 16;
        const driftY = Math.sin(angle) * 16 - 10; // slight upward bias
        return (
          <motion.div
            key={i}
            className="absolute font-mono font-semibold"
            style={{
              left: x, top: y,
              color,
              fontSize: isText ? 11 : 14,
              textShadow: `0 0 8px ${color}aa`,
              transform: 'translate(-50%, -50%)',
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: [0, 1, 0.85, 0],
              scale: [0, 1, 1, 0.6],
              x: [0, driftX, driftX * 0.5, 0],
              y: [0, driftY, driftY * 0.5, 0],
            }}
            transition={{
              duration: 2.6,
              repeat: Infinity,
              delay: i * 0.13,
              ease: 'easeInOut',
              times: [0, 0.3, 0.7, 1],
            }}
          >
            {glyph}
          </motion.div>
        );
      })}

      {/* A soft scanning ring around the anchor for extra "analysis" feel */}
      {rect && (
        <motion.div
          className="absolute rounded-full border"
          style={{
            left: cx, top: cy,
            width: rx * 2, height: ry * 2,
            borderColor: cfg.colors[0],
            transform: 'translate(-50%, -50%)',
          }}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: [0, 0.35, 0], scale: [0.7, 1.1, 1.25] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
    </div>
  );
}
