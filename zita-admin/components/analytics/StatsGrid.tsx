'use client';

interface Stat {
  label:    string;
  value:    string;
  delta:    string;
  positive: boolean;
  icon:     string;
}

export function StatsGrid({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-2xl p-4"
          style={{ background: '#fff', border: '1px solid #E8E6E1', boxShadow: '0 1px 3px rgba(26,26,46,0.06)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xl">{stat.icon}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: stat.positive ? '#E8F5E9' : '#FFEBEE',
                color:      stat.positive ? '#2ECC71'  : '#E74C3C',
              }}>
              {stat.delta}
            </span>
          </div>
          <div className="text-2xl font-bold" style={{ color: '#1A1A2E' }}>{stat.value}</div>
          <div className="text-xs mt-1" style={{ color: '#6B6B8A' }}>{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
