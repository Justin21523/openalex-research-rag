import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Loader2 } from 'lucide-react';

const W = 900, H = 600;
const PAD = 32;

// Map concept name → color (cycle through palette)
const PALETTE = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#06b6d4','#ec4899','#84cc16','#f97316','#6366f1',
  '#14b8a6','#f43f5e','#a3e635','#fb923c','#818cf8',
];

function getConceptColor(concept, colorMap) {
  if (!colorMap.has(concept)) {
    colorMap.set(concept, PALETTE[colorMap.size % PALETTE.length]);
  }
  return colorMap.get(concept);
}

function scaleCoords(points) {
  if (!points.length) return [];
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  return points.map((p) => ({
    ...p,
    sx: PAD + ((p.x - minX) / rangeX) * (W - 2 * PAD),
    sy: PAD + ((p.y - minY) / rangeY) * (H - 2 * PAD),
  }));
}

export function ClusterViz({ topN = 3000 }) {
  const [raw, setRaw] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tooltip, setTooltip] = useState(null);
  const colorMap = useRef(new Map());
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    setError('');
    api.getTopicCluster(topN)
      .then((d) => setRaw(d.points || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [topN]);

  const points = useMemo(() => scaleCoords(raw), [raw]);

  // Build legend (top 10 concepts by count)
  const legend = useMemo(() => {
    const counts = {};
    raw.forEach((p) => { counts[p.concept] = (counts[p.concept] || 0) + 1; });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([concept, count]) => ({ concept, count, color: getConceptColor(concept, colorMap.current) }));
  }, [raw]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 size={32} className="animate-spin text-blue-500" />
        <p className="text-slate-500 text-sm">Running UMAP on {topN.toLocaleString()} papers… (may take 30-60s)</p>
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-red-500 text-sm bg-red-50 dark:bg-red-900/20 rounded-xl">{error}</div>;
  }

  if (!points.length) return null;

  return (
    <div className="relative">
      <p className="text-xs text-slate-500 mb-3">
        {points.length.toLocaleString()} papers · 2D UMAP projection · click a dot to open paper · color = top concept
      </p>
      <div className="flex gap-4">
        {/* SVG */}
        <div className="relative flex-1">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full rounded-xl"
            style={{ background: '#0f172a' }}
          >
            {points.map((p) => (
              <circle
                key={p.work_id}
                cx={p.sx}
                cy={p.sy}
                r={3}
                fill={getConceptColor(p.concept, colorMap.current)}
                fillOpacity={0.75}
                className="cursor-pointer hover:r-5"
                onMouseEnter={() => setTooltip(p)}
                onMouseLeave={() => setTooltip(null)}
                onClick={() => navigate(`/works/${p.work_id}`)}
              />
            ))}
          </svg>

          {/* Tooltip */}
          {tooltip && (
            <div
              className="absolute pointer-events-none bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white shadow-xl max-w-xs z-10"
              style={{ left: '50%', top: 8, transform: 'translateX(-50%)' }}
            >
              <p className="font-semibold line-clamp-2">{tooltip.title}</p>
              <p className="text-slate-400 mt-0.5">{tooltip.year} · {tooltip.concept}</p>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="w-44 shrink-0">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Top Concepts</p>
          <div className="space-y-1.5">
            {legend.map(({ concept, count, color }) => (
              <div key={concept} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                <span className="text-xs text-slate-700 dark:text-slate-300 truncate" title={concept}>
                  {concept.slice(0, 20)}
                </span>
                <span className="text-xs text-slate-400 ml-auto shrink-0">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
