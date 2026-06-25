import { motion } from 'framer-motion';

const TOKENS = ['#attention', '#neural', '#bert', '#idf', '#tf'];
const DECIMALS = ['0.384', '−0.291', '0.157', '−0.442', '0.813', '0.023'];

// 8-point elliptical orbit for embedding dots
const ORBIT_POINTS = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * 2 * Math.PI;
  return { x: Math.cos(angle) * 90, y: Math.sin(angle) * 40 };
});

const COLORS = ['#a78bfa', '#818cf8', '#38bdf8', '#34d399', '#fb923c', '#f472b6', '#facc15', '#c084fc'];

export function BM25Aura() {
  return (
    <div
      style={{
        position: 'absolute', inset: -20, pointerEvents: 'none', zIndex: 30,
        overflow: 'visible',
      }}
    >
      {/* Corner # symbols */}
      {[
        { top: 4, left: 4 }, { top: 4, right: 4 },
        { bottom: 4, left: 4 }, { bottom: 4, right: 4 },
      ].map((style, i) => (
        <motion.div
          key={i}
          style={{ position: 'absolute', ...style, color: '#f59e0b', fontWeight: 700, fontSize: 18 }}
          animate={{ scale: [1, 1.5, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
        >
          #
        </motion.div>
      ))}

      {/* Token chips drifting in from sides */}
      {TOKENS.map((tok, i) => (
        <motion.div
          key={tok}
          style={{
            position: 'absolute',
            top: `${20 + i * 14}%`,
            left: i % 2 === 0 ? -60 : undefined,
            right: i % 2 !== 0 ? -60 : undefined,
            background: '#fef3c7',
            color: '#92400e',
            fontSize: 11,
            fontFamily: 'monospace',
            padding: '2px 6px',
            borderRadius: 4,
            border: '1px solid #fcd34d',
            whiteSpace: 'nowrap',
          }}
          animate={{
            x: i % 2 === 0 ? [0, 70, 0] : [0, -70, 0],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 2.0,
            repeat: Infinity,
            delay: i * 0.4,
            ease: 'easeInOut',
          }}
        >
          {tok}
        </motion.div>
      ))}

      {/* tf/idf values rising from bottom */}
      {['tf:0.14', 'idf:3.72', 'tf:0.09', 'idf:2.88'].map((val, i) => (
        <motion.div
          key={val + i}
          style={{
            position: 'absolute',
            bottom: 0,
            left: `${15 + i * 22}%`,
            color: '#d97706',
            fontSize: 11,
            fontFamily: 'monospace',
            fontWeight: 600,
          }}
          animate={{ y: [0, -60, -100], opacity: [0, 1, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.5, ease: 'easeOut' }}
        >
          {val}
        </motion.div>
      ))}

      {/* Central formula pulse */}
      <motion.div
        style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#b45309',
          fontSize: 13,
          fontFamily: 'monospace',
          fontWeight: 700,
          letterSpacing: 1,
          userSelect: 'none',
        }}
        animate={{ opacity: [0.2, 0.9, 0.2] }}
        transition={{ duration: 2.0, repeat: Infinity }}
      >
        BM25(q,d)
      </motion.div>
    </div>
  );
}

export function EmbeddingsAura() {
  return (
    <div
      style={{
        position: 'absolute', inset: -20, pointerEvents: 'none', zIndex: 30,
        overflow: 'visible',
      }}
    >
      {/* Sonar ping */}
      <motion.div
        style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 60, height: 60,
          borderRadius: '50%',
          border: '2px solid #a78bfa',
        }}
        animate={{ scale: [0, 3], opacity: [0.8, 0] }}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 0.5 }}
      />

      {/* Orbit dots */}
      {ORBIT_POINTS.map((pt, i) => (
        <motion.div
          key={i}
          style={{
            position: 'absolute',
            top: '50%', left: '50%',
            width: 8, height: 8,
            borderRadius: '50%',
            background: COLORS[i],
            marginLeft: -4, marginTop: -4,
          }}
          animate={{
            x: ORBIT_POINTS.map((p) => p.x),
            y: ORBIT_POINTS.map((p) => p.y),
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'linear',
            delay: -(i / 8) * 3,
          }}
        />
      ))}

      {/* Decimal floats */}
      {DECIMALS.map((d, i) => (
        <motion.div
          key={d + i}
          style={{
            position: 'absolute',
            top: `${10 + i * 14}%`,
            right: i % 2 === 0 ? 8 : undefined,
            left: i % 2 !== 0 ? 8 : undefined,
            color: '#7c3aed',
            fontSize: 10,
            fontFamily: 'monospace',
          }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.25 }}
        >
          {d}
        </motion.div>
      ))}

      {/* 384-dim scan line */}
      <motion.div
        style={{
          position: 'absolute', top: 8, left: '10%',
          color: '#8b5cf6', fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
        }}
        animate={{ x: [0, 120, 0], opacity: [0, 1, 0] }}
        transition={{ duration: 2.5, repeat: Infinity }}
      >
        384-dim →
      </motion.div>
    </div>
  );
}
