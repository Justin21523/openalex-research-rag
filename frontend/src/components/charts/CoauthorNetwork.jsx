import { useEffect, useRef, useState } from 'react';

const W = 760, H = 480, CX = W / 2, CY = H / 2;

// Simple iterative force simulation (no d3 dependency)
function runForceLayout(nodes, edges, iterations = 120) {
  const pos = nodes.map((_, i) => {
    const angle = (i / nodes.length) * 2 * Math.PI;
    return { x: CX + Math.cos(angle) * 180, y: CY + Math.sin(angle) * 160 };
  });

  const REPEL = 3200, ATTRACT = 0.06, CENTER = 0.012;

  for (let iter = 0; iter < iterations; iter++) {
    const forces = pos.map(() => ({ x: 0, y: 0 }));

    // Repulsion between all node pairs
    for (let a = 0; a < pos.length; a++) {
      for (let b = a + 1; b < pos.length; b++) {
        const dx = pos[a].x - pos[b].x;
        const dy = pos[a].y - pos[b].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const f = REPEL / (dist * dist);
        forces[a].x += (dx / dist) * f;
        forces[a].y += (dy / dist) * f;
        forces[b].x -= (dx / dist) * f;
        forces[b].y -= (dy / dist) * f;
      }
    }

    // Attraction along edges
    for (const e of edges) {
      const dx = pos[e.target].x - pos[e.source].x;
      const dy = pos[e.target].y - pos[e.source].y;
      forces[e.source].x += dx * ATTRACT;
      forces[e.source].y += dy * ATTRACT;
      forces[e.target].x -= dx * ATTRACT;
      forces[e.target].y -= dy * ATTRACT;
    }

    // Center gravity
    for (let i = 0; i < pos.length; i++) {
      forces[i].x += (CX - pos[i].x) * CENTER;
      forces[i].y += (CY - pos[i].y) * CENTER;
    }

    for (let i = 0; i < pos.length; i++) {
      pos[i].x = Math.max(24, Math.min(W - 24, pos[i].x + forces[i].x));
      pos[i].y = Math.max(24, Math.min(H - 24, pos[i].y + forces[i].y));
    }
  }
  return pos;
}

export function CoauthorNetwork({ centerName, nodes = [], edges = [], onNodeClick }) {
  const [positions, setPositions] = useState([]);
  const [tooltip, setTooltip] = useState(null);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    if (!nodes.length) return;
    // Build index map for edges (edges come as {source: centerId, target: nodeId})
    const idxMap = {};
    nodes.forEach((n, i) => { idxMap[n.id] = i; });
    // All edges connect center (not in nodes array) to coauthors —
    // for layout, treat coauthors as nodes[0..n-1] and apply only repulsion + center pull
    const layoutEdges = []; // no inter-coauthor edges for now
    const pos = runForceLayout(nodes, layoutEdges, 100);
    setPositions(pos);
  }, [nodes]);

  if (!nodes.length) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        No co-authors found in the knowledge base
      </div>
    );
  }

  const maxShared = Math.max(...nodes.map((n) => n.shared_works || 1));
  const nr = (n, isH) => {
    const base = 7 + ((n.shared_works || 1) / maxShared) * 14;
    return base + (isH ? 4 : 0);
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl" style={{ background: '#0f172a' }}>
      {/* Legend */}
      <circle cx={18} cy={16} r={5} fill="#6366f1" />
      <text x={28} y={20} fill="#64748b" fontSize={10}>Co-author (size = shared works)</text>
      <circle cx={18} cy={32} r={7} fill="#f59e0b" />
      <text x={28} y={36} fill="#64748b" fontSize={10}>Selected author</text>

      {/* Edges from center to each coauthor */}
      {positions.map((p, i) => (
        <line
          key={`e-${i}`}
          x1={CX} y1={CY}
          x2={p.x} y2={p.y}
          stroke="#6366f1"
          strokeWidth={Math.max(0.8, (nodes[i]?.shared_works || 1) / maxShared * 3)}
          strokeOpacity={0.3}
        />
      ))}

      {/* Co-author nodes */}
      {positions.map((p, i) => {
        const node = nodes[i];
        if (!node) return null;
        const isH = hovered === i;
        const r = nr(node, isH);
        return (
          <g
            key={`n-${i}`}
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => { setTooltip({ ...node, px: p.x, py: p.y }); setHovered(i); }}
            onMouseLeave={() => { setTooltip(null); setHovered(null); }}
            onClick={() => onNodeClick?.(node.id, node.name)}
          >
            <circle
              cx={p.x} cy={p.y} r={r}
              fill={isH ? '#4f46e5' : '#312e81'}
              stroke={isH ? '#818cf8' : '#6366f1'}
              strokeWidth={isH ? 2.5 : 1.5}
            />
            {r > 12 && (
              <text
                x={p.x} y={p.y + 3}
                textAnchor="middle"
                fill="#c7d2fe"
                fontSize={8}
                fontWeight="500"
              >
                {(node.name || '').split(' ').pop()?.slice(0, 8)}
              </text>
            )}
          </g>
        );
      })}

      {/* Center node */}
      <circle cx={CX} cy={CY} r={22} fill="#92400e" stroke="#f59e0b" strokeWidth={2.5} />
      <text x={CX} y={CY + 4} textAnchor="middle" fill="white" fontSize={9} fontWeight="bold">
        {(centerName || 'Author').split(' ').slice(-1)[0]?.slice(0, 10)}
      </text>

      {/* Tooltip */}
      {tooltip && (
        <foreignObject
          x={Math.min(tooltip.px + 14, W - 200)}
          y={Math.max(tooltip.py - 56, 4)}
          width={190}
          height={72}
        >
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            style={{
              background: '#1e293b', color: '#f1f5f9', padding: '8px 10px',
              borderRadius: '8px', fontSize: '11px', lineHeight: '1.5',
              border: '1px solid #334155',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 2 }}>
              {(tooltip.name || '').slice(0, 40)}
            </div>
            <div style={{ color: '#94a3b8' }}>
              {tooltip.shared_works} shared work{tooltip.shared_works !== 1 ? 's' : ''}
            </div>
            <div style={{ color: '#60a5fa', fontSize: 10, marginTop: 2 }}>Click to view profile →</div>
          </div>
        </foreignObject>
      )}
    </svg>
  );
}
