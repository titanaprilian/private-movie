export interface MetricItem {
  id: string;
  label: string;
  value: string;
  change: string;
  isPositive: boolean;
}

const METRICS: MetricItem[] = [
  {
    id: 'metric-1',
    label: 'Metric one',
    value: '1,204',
    change: '+12% from last period',
    isPositive: true,
  },
  {
    id: 'metric-2',
    label: 'Metric two',
    value: '386',
    change: '+4% from last period',
    isPositive: true,
  },
  {
    id: 'metric-3',
    label: 'Metric three',
    value: '72%',
    change: '-2% from last period',
    isPositive: false,
  },
  {
    id: 'metric-4',
    label: 'Metric four',
    value: '$18.2k',
    change: '+9% from last period',
    isPositive: true,
  },
];

export function MetricsGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
      {METRICS.map((metric) => (
        <div key={metric.id} className="bg-card border border-c rounded p-4">
          <div className="text-xs text-muted mb-1">{metric.label}</div>
          <div className="text-xl font-semibold mono">{metric.value}</div>
          <div
            className={`text-[11px] mt-1 ${
              metric.isPositive ? 'text-green-500' : 'text-red-500'
            }`}
          >
            {metric.change}
          </div>
        </div>
      ))}
    </div>
  );
}
