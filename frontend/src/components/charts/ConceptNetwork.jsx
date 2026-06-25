import { useState, useMemo } from 'react';

export function ConceptNetwork({ nodes = [], edges = [] }) {
  const [tooltip, setTooltip] = useState(null);

  const W = 800, H = 480;
  const cx = W / 2, cy = H / 2;
  const R = 190;

  const positions = useMemo(() => {
    return nodes.map((_, i) => {
      const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
      return { x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) };
    });
  }, [nodes.length]);

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        No concept data available
      </div>
    );
  }

  const maxWeight = Math.max(...nodes.map((n) => n.count ?? 1), 1);
  const maxEdgeWeight = Math.max(...edges.map((e) => e.weight ?? 1), 1);

  const nodeRadius = (w) => Math.max(8, Math.min(22, 8 + (w / maxWeight) * 14));

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded-xl"
        style={{ background: '#0f172a' }}
      >
        {/* Edges */}
        {edges.map((e, i) => {
          const si = nodes.findIndex((n) => n.id === e.source);
          const ti = nodes.findIndex((n) => n.id === e.target);
          if (si < 0 || ti < 0) return null;
          const opacity = 0.15 + 0.6 * (e.weight / maxEdgeWeight);
          const width = 0.5 + (e.weight / maxEdgeWeight) * 3;
          return (
            <line
              key={i}
              x1={positions[si].x} y1={positions[si].y}
              x2={positions[ti].x} y2={positions[ti].y}
              stroke="#3b82f6"
              strokeWidth={width}
              strokeOpacity={opacity}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node, i) => {
          const r = nodeRadius(node.count ?? 1);
          const { x, y } = positions[i];
          return (
            <g
              key={i}
              onMouseEnter={() => setTooltip({ ...node, x, y })}
              onMouseLeave={() => setTooltip(null)}
              style={{ cursor: 'pointer' }}
            >
              <circle cx={x} cy={y} r={r} fill="#1b6ca8" stroke="#3b82f6" strokeWidth={1.5} />
              <text
                x={x}
                y={y + r + 11}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize={10}
                className="pointer-events-none"
              >
                {node.name?.length > 14 ? node.name.slice(0, 13) + '…' : node.name}
              </text>
            </g>
          );
        })}

        {/* Tooltip */}
        {tooltip && (
          <foreignObject
            x={Math.min(tooltip.x + 14, W - 180)}
            y={Math.max(tooltip.y - 50, 4)}
            width={170}
            height={64}
          >
            <div
              xmlns="http://www.w3.org/1999/xhtml"
              style={{
                background: '#1e293b',
                color: '#f1f5f9',
                padding: '8px 10px',
                borderRadius: '8px',
                fontSize: '12px',
                lineHeight: '1.5',
                border: '1px solid #334155',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{tooltip.name}</div>
              <div style={{ color: '#94a3b8' }}>{tooltip.count?.toLocaleString()} papers</div>
            </div>
          </foreignObject>
        )}
      </svg>
    </div>
  );
}
