'use client';

import {
  ResponsiveContainer, LineChart as ReLineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

interface Props { data: any[]; xKey: string; yKey: string; color?: string; }

export function LineChart({ data, xKey, yKey, color = '#E8B84B' }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ReLineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E8E6E1" vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: '#6B6B8A' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#6B6B8A' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ background: '#1A1A2E', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '12px' }} />
        <Line type="monotone" dataKey={yKey} stroke={color} strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: color }} />
      </ReLineChart>
    </ResponsiveContainer>
  );
}
