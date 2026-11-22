import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const PALETTE = ['#245B45', '#F07832', '#7DBE9E', '#3B6EA5', '#D95D24', '#55665F'];

export function CategoryBarChart({ data = [] }) {
  if (!data.length) return null;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 12, left: -16, bottom: 28 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(36,91,69,0.12)" vertical={false} />
          <XAxis
            dataKey="category"
            tick={{ fontSize: 11, fill: '#55665F' }}
            interval={0}
            angle={-18}
            textAnchor="end"
            height={52}
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#55665F' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#FAF8EE',
              borderColor: 'rgba(36,91,69,0.2)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {data.map((_, idx) => (
              <Cell key={idx} fill={PALETTE[idx % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatusDistributionChart({ data = [] }) {
  if (!data.length) return null;
  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 6, right: 16, left: 28, bottom: 6 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(36,91,69,0.12)" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#55665F' }} />
          <YAxis dataKey="status" type="category" width={130} tick={{ fontSize: 11, fill: '#24332D' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#FAF8EE',
              borderColor: 'rgba(36,91,69,0.2)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Bar dataKey="count" fill="#245B45" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
