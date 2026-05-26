import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  Legend,
} from 'recharts';

const tooltipStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(226,232,240,0.92)',
  borderRadius: 18,
  boxShadow: '0 22px 60px rgba(15,23,42,0.13)',
  color: '#334155',
};

const chartMargin = { top: 18, right: 22, left: 0, bottom: 0 };
const gridStroke = 'rgba(148,163,184,0.22)';
const tickFillLight = '#64748b';
const currencyFormatter = (value: unknown) =>
  `PHP ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const numberFormatter = (value: unknown) => Number(value || 0).toLocaleString();

function axisTick() {
  return { fill: tickFillLight, fontSize: 12, fontWeight: 600 };
}

function SharedGrid() {
  return (
    <CartesianGrid
      vertical={false}
      strokeDasharray="5 8"
      stroke={gridStroke}
      strokeWidth={1}
    />
  );
}

function SharedAxes({ xKey = 'month' }: { xKey?: string }) {
  return (
    <>
      <XAxis
        dataKey={xKey}
        tick={axisTick()}
        tickLine={false}
        axisLine={false}
        dy={12}
      />
      <YAxis
        tick={axisTick()}
        tickFormatter={(v) => String(v)}
        tickLine={false}
        axisLine={false}
        width={58}
      />
    </>
  );
}

export function MonthlyCollectionsChart({
  data,
}: {
  data: Array<{ month: string; collected: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={data} margin={chartMargin}>
        <defs>
          <linearGradient id="monthlyCollectedFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.30} />
            <stop offset="55%" stopColor="#0ea5e9" stopOpacity={0.10} />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <SharedGrid />
        <SharedAxes />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ stroke: 'rgba(14,165,233,0.16)', strokeWidth: 2 }}
          formatter={(v: unknown) => [currencyFormatter(v), 'Collected']}
        />
        <Area
          type="monotone"
          dataKey="collected"
          stroke="#0ea5e9"
          strokeWidth={4}
          fill="url(#monthlyCollectedFill)"
          dot={false}
          activeDot={{ r: 6, stroke: '#fff', strokeWidth: 3, fill: '#0ea5e9' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function LoanDistributionChart({
  data,
}: {
  data: Array<{ label: string; count: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={data} margin={chartMargin}>
        <defs>
          <linearGradient id="loanDistributionFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.30} />
            <stop offset="55%" stopColor="#22c55e" stopOpacity={0.10} />
            <stop offset="100%" stopColor="#22c55e" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <SharedGrid />
        <SharedAxes xKey="label" />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ stroke: 'rgba(34,197,94,0.16)', strokeWidth: 2 }}
          formatter={(value: unknown) => [numberFormatter(value), 'Loans']}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#22c55e"
          strokeWidth={4}
          fill="url(#loanDistributionFill)"
          dot={false}
          activeDot={{ r: 6, stroke: '#fff', strokeWidth: 3, fill: '#22c55e' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function FinancialTrendsChart({
  data,
}: {
  data: Array<{ month: string; outstanding: number; due: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={data} margin={chartMargin}>
        <defs>
          <linearGradient id="outstandingFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#312e81" stopOpacity={0.24} />
            <stop offset="100%" stopColor="#312e81" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="dueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#db2777" stopOpacity={0.24} />
            <stop offset="100%" stopColor="#db2777" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <SharedGrid />
        <SharedAxes />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ stroke: 'rgba(219,39,119,0.12)', strokeWidth: 2 }}
          formatter={(v: unknown, name: unknown) => [
            currencyFormatter(v),
            String(name) === 'outstanding' ? 'Outstanding' : 'Due',
          ]}
        />
        <Legend
          verticalAlign="top"
          align="right"
          iconType="circle"
          wrapperStyle={{ color: '#64748b', fontSize: 12, fontWeight: 700, paddingBottom: 12 }}
        />
        <Area
          type="monotone"
          dataKey="outstanding"
          stroke="#312e81"
          strokeWidth={4}
          fill="url(#outstandingFill)"
          dot={false}
          activeDot={{ r: 6, stroke: '#fff', strokeWidth: 3, fill: '#312e81' }}
        />
        <Line
          type="monotone"
          dataKey="due"
          stroke="#db2777"
          strokeWidth={4}
          dot={false}
          strokeLinecap="round"
          activeDot={{ r: 6, stroke: '#fff', strokeWidth: 3, fill: '#db2777' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function EarningsTrendsChart({
  data,
}: {
  data: Array<{ month: string; earnings: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={data} margin={chartMargin}>
        <defs>
          <linearGradient id="earningsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a855f7" stopOpacity={0.32} />
            <stop offset="55%" stopColor="#a855f7" stopOpacity={0.11} />
            <stop offset="100%" stopColor="#a855f7" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <SharedGrid />
        <SharedAxes />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ stroke: 'rgba(168,85,247,0.16)', strokeWidth: 2 }}
          formatter={(v: unknown) => [currencyFormatter(v), 'Earnings']}
        />
        <Area
          type="monotone"
          dataKey="earnings"
          stroke="#a855f7"
          strokeWidth={4}
          fill="url(#earningsFill)"
          dot={false}
          activeDot={{ r: 6, stroke: '#fff', strokeWidth: 3, fill: '#a855f7' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function DelinquencyReportsChart({
  data,
}: {
  data: Array<{ label: string; count: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="count" fill="#ef4444" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
