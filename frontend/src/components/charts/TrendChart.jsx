import { useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const SERIES = [
  { key: 'avg_cited_by_count', label: 'Avg Citations', color: '#f59e0b', yAxis: 'citations' },
  { key: 'citation_velocity',  label: 'Citation Velocity', color: '#10b981', yAxis: 'citations' },
];

export function TrendChart({ data }) {
  const [activeSeries, setActiveSeries] = useState(
    () => new Set(SERIES.map((s) => s.key))
  );

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        No trend data available
      </div>
    );
  }

  const hasCitationVelocity = data.some((d) => d.citation_velocity != null && d.citation_velocity !== 0);

  return (
    <div>
      {/* Toggle chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        {SERIES.filter(s => s.key !== 'citation_velocity' || hasCitationVelocity).map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveSeries((prev) => {
              const next = new Set(prev);
              if (next.has(s.key)) next.delete(s.key); else next.add(s.key);
              return next;
            })}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              activeSeries.has(s.key)
                ? 'border-transparent text-white'
                : 'bg-white border-slate-200 text-slate-400'
            }`}
            style={activeSeries.has(s.key) ? { background: s.color } : {}}
          >
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: s.color }} />
            {s.label}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 8, right: 20, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 12, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="count"
            orientation="left"
            tick={{ fontSize: 12, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            label={{ value: 'Publications', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
          />
          <YAxis
            yAxisId="citations"
            orientation="right"
            tick={{ fontSize: 12, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: '#1e293b',
              border: 'none',
              borderRadius: '8px',
              color: '#f1f5f9',
              fontSize: '13px',
            }}
            labelStyle={{ color: '#94a3b8', marginBottom: 4 }}
          />
          <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
          <Bar
            yAxisId="count"
            dataKey="count"
            name="Publications"
            fill="#3b82f6"
            radius={[3, 3, 0, 0]}
            fillOpacity={0.85}
          />
          {activeSeries.has('avg_cited_by_count') && (
            <Line
              yAxisId="citations"
              type="monotone"
              dataKey="avg_cited_by_count"
              name="Avg Citations"
              stroke="#f59e0b"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#f59e0b' }}
              activeDot={{ r: 5 }}
            />
          )}
          {hasCitationVelocity && activeSeries.has('citation_velocity') && (
            <Line
              yAxisId="citations"
              type="monotone"
              dataKey="citation_velocity"
              name="Citation Velocity"
              stroke="#10b981"
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={{ r: 3, fill: '#10b981' }}
              activeDot={{ r: 5 }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
