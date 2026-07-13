'use client';

import {
  ResponsiveContainer, BarChart as ReBarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';

interface Props { data: any[]; xKey: string; yKey: string; color?: string; }

export function BarChart({ data, xKey, yKey, color = '#1A1A2E' }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ReBarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E8E6E1" vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: '#6B6B8A' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#6B6B8A' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ background: '#1A1A2E', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '12px' }} cursor={{ fill: 'rgba(26,26,46,0.05)' }} />
        <Bar dataKey={yKey} radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={i === 0 ? '#E8B84B' : color} fillOpacity={i === 0 ? 1 : 0.7} />
          ))}
        </Bar>
      </ReBarChart>
    </ResponsiveContainer>
  );
}
