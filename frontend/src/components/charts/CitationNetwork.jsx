import { useState } from 'react';

export function CitationNetwork({ center, citingWorks = [], citedWorks = [], onNodeClick }) {
  const [tooltip, setTooltip] = useState(null);
  const [hovered, setHovered] = useState(null);
  const W = 860, H = 500;
  const cx = W / 2, cy = H / 2;
  const R = 195;

  const citingPos = citingWorks.map((_, i) => {
    const count = Math.max(citingWorks.length, 1);
    const angle = Math.PI * 0.1 + (Math.PI * 0.8 * i) / Math.max(count - 1, 1);
    return { x: cx - R * Math.cos(angle), y: cy - R * Math.sin(angle) + 60 };
  });

  const citedPos = citedWorks.map((_, i) => {
    const count = Math.max(citedWorks.length, 1);
    const angle = Math.PI * 0.1 + (Math.PI * 0.8 * i) / Math.max(count - 1, 1);
    return { x: cx + R * Math.cos(angle), y: cy - R * Math.sin(angle) + 60 };
  });

  const nr = (c, isHovered = false) => Math.max(6, Math.min(18, 6 + (c || 0) / 300)) + (isHovered ? 4 : 0);

  if (!center) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Select a paper to view its citation network
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl" style={{ background: '#0f172a' }}>
      {/* Legend */}
      <circle cx={18} cy={18} r={5} fill="#3b82f6" />
      <text x={28} y={22} fill="#64748b" fontSize={11}>Cites this paper (click to explore)</text>
      <circle cx={18} cy={36} r={5} fill="#10b981" />
      <text x={28} y={40} fill="#64748b" fontSize={11}>Cited by this paper (click to explore)</text>
      <circle cx={18} cy={54} r={5} fill="#f59e0b" />
      <text x={28} y={58} fill="#64748b" fontSize={11}>Selected paper</text>

      {/* Edges */}
      {citingWorks.map((_, i) => (
        <line
          key={`ci-${i}`}
          x1={citingPos[i].x} y1={citingPos[i].y}
          x2={cx} y2={cy}
          stroke="#3b82f6" strokeWidth={1.5} strokeOpacity={0.35}
        />
      ))}
      {citedWorks.map((_, i) => (
        <line
          key={`co-${i}`}
          x1={cx} y1={cy}
          x2={citedPos[i].x} y2={citedPos[i].y}
          stroke="#10b981" strokeWidth={1.5} strokeOpacity={0.35}
        />
      ))}

      {/* Citing nodes */}
      {citingWorks.map((w, i) => {
        const isH = hovered === `ci-${i}`;
        return (
          <g
            key={`cn-${i}`}
            onMouseEnter={() => { setTooltip({ ...w, px: citingPos[i].x, py: citingPos[i].y }); setHovered(`ci-${i}`); }}
            onMouseLeave={() => { setTooltip(null); setHovered(null); }}
            onClick={() => onNodeClick?.(w.work_id, w.title)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              cx={citingPos[i].x} cy={citingPos[i].y}
              r={nr(w.cited_by_count, isH)}
              fill={isH ? '#2563eb' : '#1d4ed8'} stroke="#3b82f6" strokeWidth={isH ? 2.5 : 1.5}
            />
          </g>
        );
      })}

      {/* Cited nodes */}
      {citedWorks.map((w, i) => {
        const isH = hovered === `cd-${i}`;
        return (
          <g
            key={`cd-${i}`}
            onMouseEnter={() => { setTooltip({ ...w, px: citedPos[i].x, py: citedPos[i].y }); setHovered(`cd-${i}`); }}
            onMouseLeave={() => { setTooltip(null); setHovered(null); }}
            onClick={() => onNodeClick?.(w.work_id, w.title)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              cx={citedPos[i].x} cy={citedPos[i].y}
              r={nr(w.cited_by_count, isH)}
              fill={isH ? '#059669' : '#065f46'} stroke="#10b981" strokeWidth={isH ? 2.5 : 1.5}
            />
          </g>
        );
      })}

      {/* Center node */}
      <circle cx={cx} cy={cy} r={22} fill="#b45309" stroke="#f59e0b" strokeWidth={2.5} />
      <text x={cx} y={cy - 2} textAnchor="middle" fill="white" fontSize={8} fontWeight="bold">
        {center.work_id}
      </text>
      <text x={cx} y={cy + 9} textAnchor="middle" fill="#fef3c7" fontSize={7}>
        {(center.title || '').slice(0, 16)}…
      </text>

      {/* Tooltip */}
      {tooltip && (
        <foreignObject
          x={Math.min(tooltip.px + 14, W - 210)}
          y={Math.max(tooltip.py - 56, 4)}
          width={200}
          height={90}
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
              {(tooltip.title || '').slice(0, 55)}{tooltip.title?.length > 55 ? '…' : ''}
            </div>
            <div style={{ color: '#94a3b8' }}>
              {tooltip.publication_year} · {tooltip.cited_by_count?.toLocaleString() ?? 0} cited
            </div>
            <div style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 10 }}>{tooltip.work_id}</div>
            <div style={{ color: '#60a5fa', fontSize: 10, marginTop: 2 }}>Click to explore →</div>
          </div>
        </foreignObject>
      )}
    </svg>
  );
}
