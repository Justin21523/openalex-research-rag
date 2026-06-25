/**
 * StageAura — theatrical ambient particles and effects surrounding each active Stage card.
 *
 * Rendered as position:absolute with pointer-events:none so it floats around
 * the card without blocking any clicks.
 */
import { motion, AnimatePresence } from 'framer-motion';

// Reusable floating particle (motion.div wrapper)
function FP({ style, className = '', animate, transition, initial, children }) {
  return (
    <motion.div
      className={`absolute pointer-events-none select-none ${className}`}
      style={style}
      initial={initial ?? { opacity: 0, scale: 0.6 }}
      animate={animate}
      transition={transition}
    >
      {children}
    </motion.div>
  );
}

// ── Stage 0: Raw OpenAlex Data (sky) ──────────────────────────────────────────
function Aura0() {
  const jsonKeys = [
    { text: '"title"',    style: { left: '-8px',  top: '28%' },  delay: 0    },
    { text: '"abstract"', style: { right: '-8px', top: '52%' },  delay: 1.2  },
    { text: '"year"',     style: { left: '10%',   top: '-10px' }, delay: 0.7  },
    { text: '"W12345"',   style: { right: '12%',  top: '-10px' }, delay: 2.0  },
    { text: '{ }',        style: { left: '-8px',  bottom: '18%' }, delay: 1.5 },
    { text: '[ ]',        style: { right: '-8px', top: '25%' },  delay: 0.4  },
    { text: '"concepts"', style: { left: '35%',   bottom: '-10px' }, delay: 0.9 },
  ];

  return (
    <>
      {jsonKeys.map(({ text, style, delay }, i) => (
        <FP
          key={i}
          style={style}
          className="text-xs font-mono px-1.5 py-0.5 bg-sky-100/90 text-sky-600 border border-sky-200 rounded shadow-sm"
          initial={{ opacity: 0, y: 0 }}
          animate={{ y: [0, -30, -65, -95], opacity: [0, 1, 0.8, 0] }}
          transition={{ duration: 3.8, delay, repeat: Infinity, repeatDelay: 0.8, ease: 'easeOut' }}
        >
          {text}
        </FP>
      ))}

      {/* Data stream dots flowing upward on right edge */}
      {[0, 0.75, 1.5].map((delay, i) => (
        <FP
          key={`dot${i}`}
          style={{ right: -10, top: '72%' }}
          className="w-2 h-2 bg-sky-400 rounded-full"
          initial={{ opacity: 0 }}
          animate={{ y: [0, -180, -240], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 2.4, delay, repeat: Infinity, repeatDelay: 0.2 }}
        />
      ))}

      {/* Database icon pulsing in bottom-left corner */}
      <FP
        style={{ left: -10, bottom: '12%' }}
        className="text-xl"
        initial={{ opacity: 0 }}
        animate={{ scale: [1, 1.25, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2.2, repeat: Infinity }}
      >
        🗄️
      </FP>
    </>
  );
}

// ── Stage 1: Text Preprocessing (violet) ──────────────────────────────────────
function Aura1() {
  const htmlTags = ['<b>', '</i>', '<br/>', '<span>', '&amp;'];
  const positions = [
    { left: '-6px', top: '22%' },
    { right: '-6px', top: '38%' },
    { left: '38%',  top: '-10px' },
    { left: '-6px', bottom: '22%' },
    { right: '-6px', bottom: '35%' },
  ];

  return (
    <>
      {/* HTML tags appearing with red strikethrough then fading */}
      {htmlTags.map((tag, i) => (
        <FP
          key={i}
          style={positions[i]}
          className="text-xs font-mono text-red-400 line-through bg-red-50/80 px-1 py-0.5 rounded border border-red-200/60"
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.7, 1, 1, 0.5] }}
          transition={{ duration: 2.8, delay: i * 0.55, repeat: Infinity, repeatDelay: 0.7 }}
        >
          {tag}
        </FP>
      ))}

      {/* Scissors sliding across top edge */}
      <FP
        style={{ top: -20, left: 0 }}
        className="text-xl"
        initial={{ opacity: 1, x: 0 }}
        animate={{ x: ['0%', '85%', '85%', '0%'] }}
        transition={{
          duration: 4.5,
          repeat: Infinity,
          times: [0, 0.42, 0.58, 1],
          ease: 'easeInOut',
          delay: 0.5,
        }}
      >
        ✂️
      </FP>

      {/* Transform arrows on sides */}
      <FP
        style={{ left: -16, top: '48%' }}
        className="text-violet-400 text-base font-bold"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.2, 1, 0.2], x: [0, 4, 0] }}
        transition={{ duration: 1.6, repeat: Infinity }}
      >
        →
      </FP>
      <FP
        style={{ right: -16, top: '58%' }}
        className="text-violet-400 text-base font-bold"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.2, 1, 0.2], x: [0, -4, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, delay: 0.8 }}
      >
        ←
      </FP>

      {/* Token chips appearing */}
      {['token', 'clean', 'lower'].map((word, i) => (
        <FP
          key={`tok${i}`}
          style={{ right: '-6px', top: `${[18, 45, 72][i]}%` }}
          className="text-xs font-mono px-1.5 py-0.5 bg-violet-100/90 text-violet-700 rounded border border-violet-200/60"
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: [0, 1, 1, 0], x: [10, 0, 0, -5] }}
          transition={{ duration: 3, delay: i * 0.7, repeat: Infinity, repeatDelay: 0.6 }}
        >
          {word}
        </FP>
      ))}
    </>
  );
}

// ── Stage 2: BM25 Scoring (amber) ──────────────────────────────────────────────
function Aura2() {
  const hashPositions = [
    { left: '-14px', top: '20%' },
    { left: '-14px', top: '60%' },
    { right: '-14px', top: '32%' },
    { right: '-14px', top: '68%' },
    { left: '28%', top: '-14px' },
    { left: '62%', top: '-14px' },
    { left: '45%', bottom: '-14px' },
  ];

  const scores = ['12.4', '8.71', '5.09', '3.22', '1.87'];
  const scorePositions = [
    { left: '8%',  bottom: '-14px' },
    { left: '28%', bottom: '-14px' },
    { right: '25%', bottom: '-14px' },
    { right: '8%', bottom: '-14px' },
    { left: '55%', bottom: '-14px' },
  ];

  return (
    <>
      {/* Hashtag symbols pulsing on edges */}
      {hashPositions.map((style, i) => (
        <FP
          key={i}
          style={style}
          className="text-amber-500 font-black text-lg font-mono"
          initial={{ opacity: 0 }}
          animate={{
            scale: [0.7, 1.4, 0.9, 1.2, 0.7],
            opacity: [0.3, 1, 0.6, 1, 0.3],
            rotate: [0, 8, -5, 3, 0],
          }}
          transition={{ duration: 2.4 + i * 0.2, delay: i * 0.3, repeat: Infinity }}
        >
          #
        </FP>
      ))}

      {/* BM25 score values rising from bottom */}
      {scores.map((s, i) => (
        <FP
          key={`sc${i}`}
          style={scorePositions[i]}
          className="text-xs font-mono font-bold text-amber-700 bg-amber-100/90 px-1.5 py-0.5 rounded border border-amber-200 shadow-sm"
          initial={{ opacity: 0 }}
          animate={{ y: [0, -40, -80, -110], opacity: [0, 1, 0.8, 0] }}
          transition={{ duration: 3, delay: i * 0.65, repeat: Infinity, repeatDelay: 0.4 }}
        >
          {s}
        </FP>
      ))}

      {/* Magnifying glass scanning left side */}
      <FP
        style={{ left: -22, top: '18%' }}
        className="text-2xl"
        initial={{ opacity: 0.8 }}
        animate={{ y: [0, 60, 130, 60, 0], opacity: [0.7, 1, 0.7, 1, 0.7] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        🔍
      </FP>

      {/* Rank badges popping in */}
      {['#1', '#2', '#3'].map((badge, i) => (
        <FP
          key={`rank${i}`}
          style={{ right: -6, top: `${[12, 38, 62][i]}%` }}
          className="text-xs font-bold font-mono px-1.5 py-1 bg-amber-400 text-white rounded-full shadow"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0, 1.2, 1, 0.5] }}
          transition={{ duration: 2.5, delay: 0.4 + i * 0.5, repeat: Infinity, repeatDelay: 1.5 }}
        >
          {badge}
        </FP>
      ))}
    </>
  );
}

// ── Stage 3: Vector Embedding (purple) ────────────────────────────────────────
function Aura3() {
  // 8 dots orbiting in an ellipse centred on the card
  const N = 8;
  const orbitDots = Array.from({ length: N }, (_, idx) => {
    const baseAngle = (idx / N) * 360;
    const angles = [0, 90, 180, 270, 360];
    const frames = angles.map((a) => {
      const r = ((baseAngle + a) * Math.PI) / 180;
      return { x: Math.cos(r) * 68, y: Math.sin(r) * 26 };
    });
    return { frames, delay: (idx / N) * 3.8 };
  });

  const floatVals = ['0.234', '-0.087', '0.512', '-0.341', '0.789', '0.123'];
  const valPositions = [
    { left: '-6px',  top: '20%' },
    { right: '-6px', top: '30%' },
    { left: '40%',   top: '-12px' },
    { left: '-6px',  bottom: '28%' },
    { right: '-6px', bottom: '38%' },
    { left: '60%',   bottom: '-12px' },
  ];

  return (
    <>
      {/* Orbiting constellation dots */}
      {orbitDots.map(({ frames, delay }, i) => (
        <FP
          key={i}
          style={{ left: '50%', top: '50%', marginLeft: -3, marginTop: -3 }}
          className="w-1.5 h-1.5 bg-purple-400 rounded-full"
          initial={{ opacity: 0 }}
          animate={{
            x: frames.map((f) => f.x),
            y: frames.map((f) => f.y),
            opacity: [0.2, 0.9, 0.5, 0.9, 0.2],
          }}
          transition={{ duration: 3.8, delay, repeat: Infinity, ease: 'linear' }}
        />
      ))}

      {/* Floating dimension values */}
      {floatVals.map((val, i) => (
        <FP
          key={`v${i}`}
          style={valPositions[i]}
          className="text-xs font-mono text-purple-600 bg-purple-50/90 border border-purple-200/60 px-1 py-0.5 rounded"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.9, 0.9, 0], y: [0, -10, -8, -18] }}
          transition={{ duration: 4, delay: i * 0.7, repeat: Infinity, repeatDelay: 0.5 }}
        >
          {val}
        </FP>
      ))}

      {/* Sonar ping rings */}
      {[0, 1.5].map((delay, i) => (
        <FP
          key={`sonar${i}`}
          style={{ right: -20, top: '28%', width: 32, height: 32 }}
          className="rounded-full border-2 border-purple-400"
          initial={{ opacity: 0.8, scale: 0.3 }}
          animate={{ scale: [0.3, 2.5], opacity: [0.8, 0] }}
          transition={{ duration: 2.2, delay, repeat: Infinity, repeatDelay: 0.8 }}
        />
      ))}

      {/* Brain icon pulsing bottom-left */}
      <FP
        style={{ left: -12, bottom: '15%' }}
        className="text-xl"
        initial={{ opacity: 0 }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 2.8, repeat: Infinity }}
      >
        🧠
      </FP>
    </>
  );
}

// ── Stage 4: Hybrid RRF Fusion (teal) ────────────────────────────────────────
function Aura4() {
  return (
    <>
      {/* Blue BM25 stream flowing right from left edge */}
      {[0, 0.55, 1.1].map((delay, i) => (
        <FP
          key={`bm${i}`}
          style={{ left: -10, top: `${[28, 44, 60][i]}%` }}
          className="w-3 h-3 bg-blue-400 rounded-full shadow-md"
          initial={{ opacity: 0 }}
          animate={{ x: [0, 70, 160, 230], opacity: [0, 1, 0.8, 0] }}
          transition={{ duration: 1.6, delay: delay + i * 0.05, repeat: Infinity, repeatDelay: 0.7 }}
        />
      ))}

      {/* Purple Vector stream flowing left from right edge */}
      {[0.3, 0.85, 1.4].map((delay, i) => (
        <FP
          key={`vc${i}`}
          style={{ right: -10, top: `${[33, 49, 65][i]}%` }}
          className="w-3 h-3 bg-purple-400 rounded-full shadow-md"
          initial={{ opacity: 0 }}
          animate={{ x: [0, -70, -160, -230], opacity: [0, 1, 0.8, 0] }}
          transition={{ duration: 1.6, delay: delay + i * 0.05, repeat: Infinity, repeatDelay: 0.7 }}
        />
      ))}

      {/* Teal merged output flowing down from bottom */}
      {[0, 0.5, 1.0].map((delay, i) => (
        <FP
          key={`out${i}`}
          style={{ left: `${[40, 48, 56][i]}%`, bottom: -10 }}
          className="w-3 h-3 bg-teal-400 rounded-full shadow-md"
          initial={{ opacity: 0 }}
          animate={{ y: [0, 30, 65], opacity: [0, 1, 0] }}
          transition={{ duration: 1.3, delay, repeat: Infinity, repeatDelay: 0.9 }}
        />
      ))}

      {/* Lightning bolt center-top flash */}
      <FP
        style={{ left: '46%', top: -22 }}
        className="text-2xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 1, 1, 0, 0], scale: [0.6, 0.6, 1.3, 1.0, 0.6, 0.6] }}
        transition={{ duration: 3, repeat: Infinity, times: [0, 0.3, 0.45, 0.55, 0.7, 1] }}
      >
        ⚡
      </FP>

      {/* Merge label */}
      <FP
        style={{ left: '30%', bottom: -20 }}
        className="text-xs font-mono font-bold text-teal-600 bg-teal-50/90 px-2 py-0.5 rounded border border-teal-200"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: 4, repeat: Infinity }}
      >
        fused ↓
      </FP>
    </>
  );
}

// ── Stage 5: RAG Context Assembly (orange) ────────────────────────────────────
function Aura5() {
  const docConfigs = [
    { style: { left: '-10px', top: '-10px' }, from: { x: -30, y: -30 }, delay: 0    },
    { style: { right: '-10px', top: '-10px' }, from: { x: 30, y: -30 }, delay: 0.7  },
    { style: { left: '-10px', bottom: '10%' }, from: { x: -30, y: 20 }, delay: 1.4  },
    { style: { right: '-10px', bottom: '10%' }, from: { x: 30, y: 20 }, delay: 2.1  },
  ];

  return (
    <>
      {/* Document icons flying from corners toward center */}
      {docConfigs.map(({ style, from, delay }, i) => (
        <FP
          key={i}
          style={style}
          className="text-lg"
          initial={{ opacity: 0, x: from.x, y: from.y, scale: 1 }}
          animate={{
            x: [from.x, from.x * 0.5, 0],
            y: [from.y, from.y * 0.5, 0],
            scale: [1, 0.9, 0.4],
            opacity: [0, 1, 0],
          }}
          transition={{ duration: 2.4, delay, repeat: Infinity, repeatDelay: 1.6 }}
        >
          📄
        </FP>
      ))}

      {/* Context fill bar sweeping bottom */}
      <FP
        style={{ left: 0, bottom: -8, height: 3, width: '0%', borderRadius: 4 }}
        className="bg-orange-400"
        initial={{ width: '0%', opacity: 1 }}
        animate={{ width: ['0%', '100%', '100%', '0%'], opacity: [0.8, 1, 0.8, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, repeatDelay: 0.5, times: [0, 0.5, 0.8, 1] }}
      />

      {/* Token counter ticking on right */}
      {['128', '256', '512', '1024', '2048'].map((n, i) => (
        <FP
          key={`t${i}`}
          style={{ right: -6, top: `${[20, 35, 50, 65, 80][i]}%` }}
          className="text-xs font-mono text-orange-600 bg-orange-100/90 px-1.5 py-0.5 rounded border border-orange-200/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{ duration: 0.8, delay: i * 0.3, repeat: Infinity, repeatDelay: 2.2 }}
        >
          {n}
        </FP>
      ))}

      {/* Text lines scrolling in from left */}
      {[0, 0.6, 1.2].map((delay, i) => (
        <FP
          key={`line${i}`}
          style={{ left: -14, top: `${[30, 48, 66][i]}%` }}
          className={`h-0.5 bg-orange-300 rounded ${['w-5', 'w-4', 'w-6'][i]}`}
          initial={{ opacity: 0 }}
          animate={{ x: [0, 24, 48, 0], opacity: [0, 1, 0, 0] }}
          transition={{ duration: 2, delay, repeat: Infinity, repeatDelay: 0.8 }}
        />
      ))}
    </>
  );
}

// ── Stage 6: Answer Generation (emerald) ─────────────────────────────────────
function Aura6() {
  const starPositions = [
    { left: '12%',  top: '-16px' },
    { left: '38%',  top: '-16px' },
    { right: '18%', top: '-16px' },
    { left: '-16px', top: '20%'  },
    { right: '-16px', top: '35%' },
    { left: '-16px', bottom: '25%' },
    { right: '-16px', bottom: '30%' },
    { left: '22%',  bottom: '-16px' },
    { right: '22%', bottom: '-16px' },
  ];

  return (
    <>
      {/* Pulsing glow ring */}
      <motion.div
        className="absolute inset-[18px] rounded-2xl pointer-events-none"
        animate={{
          boxShadow: [
            '0 0 0 0px rgba(16,185,129,0)',
            '0 0 0 10px rgba(16,185,129,0.22)',
            '0 0 0 22px rgba(16,185,129,0)',
          ],
        }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeOut' }}
      />

      {/* Star burst particles */}
      {starPositions.map((style, i) => (
        <FP
          key={i}
          style={style}
          className="text-base"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 0.8, 0], scale: [0, 1.5, 1.1, 0.3] }}
          transition={{ duration: 2.8, delay: i * 0.18, repeat: Infinity, repeatDelay: 1.2 }}
        >
          ✨
        </FP>
      ))}

      {/* Citation brackets floating upward */}
      {['[W2741…]', '[W1698…]', '[W3177…]'].map((cite, i) => (
        <FP
          key={`cite${i}`}
          style={{ left: `${[12, 42, 68][i]}%`, bottom: -12 }}
          className="text-xs font-mono font-bold text-amber-700 bg-amber-100/90 px-1.5 py-0.5 rounded border border-amber-300/60 shadow-sm"
          initial={{ opacity: 0 }}
          animate={{ y: [0, -50, -90, -120], opacity: [0, 1, 0.8, 0] }}
          transition={{ duration: 2.8, delay: i * 0.9, repeat: Infinity, repeatDelay: 0.8 }}
        >
          {cite}
        </FP>
      ))}

      {/* Rising light dots from bottom */}
      {[0, 0.4, 0.8, 1.2, 1.6].map((delay, i) => (
        <FP
          key={`ld${i}`}
          style={{ left: `${[10, 28, 50, 68, 85][i]}%`, bottom: -8 }}
          className={`w-2 h-2 rounded-full ${['bg-emerald-400', 'bg-teal-300', 'bg-emerald-300', 'bg-teal-400', 'bg-emerald-500'][i]}`}
          initial={{ opacity: 0 }}
          animate={{ y: [0, -100, -140], opacity: [0, 1, 0] }}
          transition={{ duration: 3.2, delay, repeat: Infinity, repeatDelay: 0.5 }}
        />
      ))}

      {/* Check marks appearing */}
      {['✓', '✓'].map((ch, i) => (
        <FP
          key={`chk${i}`}
          style={{ [i === 0 ? 'left' : 'right']: '-14px', top: `${[40, 60][i]}%` }}
          className="text-emerald-500 font-black text-lg"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0, 1.4, 1, 0] }}
          transition={{ duration: 2.2, delay: i * 1.1, repeat: Infinity, repeatDelay: 1.5 }}
        >
          {ch}
        </FP>
      ))}
    </>
  );
}

const AURA_COMPONENTS = [Aura0, Aura1, Aura2, Aura3, Aura4, Aura5, Aura6];

export default function StageAura({ stageIndex }) {
  const AuraContent = AURA_COMPONENTS[stageIndex] ?? null;
  if (!AuraContent) return null;

  return (
    <motion.div
      className="absolute pointer-events-none z-30"
      style={{ inset: '-24px' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <AuraContent />
    </motion.div>
  );
}
