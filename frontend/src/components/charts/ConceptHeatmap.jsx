import { useEffect, useState, useRef } from 'react';
import { api } from '../../api/client.js';
import { Spinner } from '../ui/Spinner.jsx';

function heatColor(value, max) {
  if (max === 0 || value === 0) return '#f8fafc'; // slate-50
  const t = Math.min(value / max, 1);
  if (t < 0.25) {
    // white → amber-100
    const r = Math.round(255);
    const g = Math.round(255 - (255 - 254) * (t / 0.25));
    const b = Math.round(255 - (255 - 215) * (t / 0.25));
    return `rgb(${r},${g},${b})`;
  }
  if (t < 0.6) {
    // amber-100 → amber-400
    const s = (t - 0.25) / 0.35;
    const r = Math.round(254 - (254 - 251) * s);
    const g = Math.round(254 - (254 - 191) * s);
    const b = Math.round(215 - (215 - 36) * s);
    return `rgb(${r},${g},${b})`;
  }
  // amber-400 → red-600
  const s = (t - 0.6) / 0.4;
  const r = Math.round(251 - (251 - 220) * s);
  const g = Math.round(191 - (191 - 38) * s);
  const b = Math.round(36 - (36 - 38) * s);
  return `rgb(${r},${g},${b})`;
}

export function ConceptHeatmap({ topN = 15, yearFrom = 2015, yearTo = 2024 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.getTopicHeatmap(topN, yearFrom, yearTo)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [topN, yearFrom, yearTo]);

  if (loading) return <div className="py-16 flex justify-center"><Spinner /></div>;
  if (error) return <div className="py-8 text-sm text-red-600">{error}</div>;
  if (!data) return null;

  const { concepts, years, matrix } = data;
  if (!concepts.length || !years.length) return <p className="text-sm text-slate-400 py-8 text-center">No data available.</p>;

  const maxVal = Math.max(...matrix.flat());
  const CELL_W = Math.max(28, Math.floor(700 / years.length));
  const CELL_H = 28;
  const LEFT_PAD = 200;
  const TOP_PAD = 36;

  const svgW = LEFT_PAD + CELL_W * years.length + 4;
  const svgH = TOP_PAD + CELL_H * concepts.length + 4;

  return (
    <div className="relative overflow-x-auto">
      {tooltip && (
        <div
          className="fixed z-50 px-2.5 py-1.5 bg-slate-900 text-white text-xs rounded shadow-xl pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 28 }}
        >
          <span className="font-semibold">{tooltip.concept}</span> · {tooltip.year}: <span className="text-amber-300">{tooltip.value} works</span>
        </div>
      )}
      <svg width={svgW} height={svgH} className="block">
        {/* Year labels */}
        {years.map((y, xi) => (
          <text
            key={y}
            x={LEFT_PAD + xi * CELL_W + CELL_W / 2}
            y={TOP_PAD - 6}
            textAnchor="middle"
            fontSize={9}
            fill="#94a3b8"
          >
            {xi % 2 === 0 ? y : ''}
          </text>
        ))}

        {/* Concept labels */}
        {concepts.map((c, ci) => (
          <text
            key={c}
            x={LEFT_PAD - 8}
            y={TOP_PAD + ci * CELL_H + CELL_H / 2 + 4}
            textAnchor="end"
            fontSize={10}
            fill="#475569"
          >
            {c.length > 26 ? c.slice(0, 24) + '…' : c}
          </text>
        ))}

        {/* Heat cells */}
        {concepts.map((concept, ci) =>
          years.map((year, xi) => {
            const val = matrix[ci]?.[xi] ?? 0;
            return (
              <rect
                key={`${ci}-${xi}`}
                x={LEFT_PAD + xi * CELL_W}
                y={TOP_PAD + ci * CELL_H}
                width={CELL_W - 1}
                height={CELL_H - 1}
                fill={heatColor(val, maxVal)}
                rx={2}
                className="cursor-pointer transition-opacity hover:opacity-80"
                onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, concept, year, value: val })}
                onMouseMove={(e) => setTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                onMouseLeave={() => setTooltip(null)}
              />
            );
          })
        )}

        {/* Color legend */}
        {Array.from({ length: 10 }, (_, i) => (
          <rect
            key={i}
            x={LEFT_PAD + i * 20}
            y={svgH - 18}
            width={19}
            height={10}
            rx={2}
            fill={heatColor(i * maxVal / 9, maxVal)}
          />
        ))}
        <text x={LEFT_PAD} y={svgH - 4} fontSize={9} fill="#94a3b8">0</text>
        <text x={LEFT_PAD + 200 - 4} y={svgH - 4} fontSize={9} fill="#94a3b8" textAnchor="end">
          {maxVal} works
        </text>
      </svg>
    </div>
  );
}
