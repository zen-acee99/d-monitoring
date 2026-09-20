import React from 'react';
import { 
  ResponsiveContainer, AreaChart as RechartsAreaChart, Area, 
  XAxis, YAxis, CartesianGrid, Tooltip, BarChart as RechartsBarChart, 
  Bar, PieChart, Pie, Cell 
} from 'recharts';

export interface ProjectBeneficiaryData {
  name: string;
  shortName: string;
  count?: number;
  users?: number;
  operational?: number;
  category?: string;
  color: string;
}

export const REGIONAL_BENEFICIARIES_DATA: ProjectBeneficiaryData[] = [
  { name: 'Free Wi-Fi 4 All', shortName: 'Free WiFi', count: 227, category: 'Connectivity', color: '#06B6D4' },
  { name: 'eLGU Digital Services', shortName: 'eLGU', count: 114, category: 'Governance', color: '#6366F1' },
  { name: 'Cybersecurity Operations', shortName: 'Cybersec', count: 94, category: 'Security', color: '#EF4444' },
  { name: 'PNPKI Certificates', shortName: 'PNPKI', count: 60, category: 'Security', color: '#10B981' },
  { name: 'ILCDB Training Batches', shortName: 'ILCDB', count: 30, category: 'Capacity', color: '#F59E0B' },
  { name: 'Infrastructure & MIS', shortName: 'Infra/MIS', count: 31, category: 'Infrastructure', color: '#8B5CF6' },
];

export function ProjectBarChart({ 
  data = [], 
  dataKey = "count",
  metricLabel = "Deployments" 
}: { 
  data?: ProjectBeneficiaryData[]; 
  dataKey?: "count" | "users";
  metricLabel?: string;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-slate-500">
        No project operations recorded
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsBarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1A2235" />
        <XAxis 
          dataKey="shortName" 
          stroke="#64748B" 
          fontSize={10} 
          tickLine={false} 
          axisLine={false} 
          interval={0} 
          angle={-30} 
          textAnchor="end" 
          dy={8} 
        />
        <YAxis 
          stroke="#64748B" 
          fontSize={10} 
          tickLine={false} 
          axisLine={false} 
          tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} 
        />
        <Tooltip 
          cursor={{ fill: 'rgba(255,255,255,0.03)' }} 
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const item = payload[0].payload as ProjectBeneficiaryData;
              const val = item.count ?? item.users ?? 0;
              return (
                <div className="bg-[#070D18] border border-[#1E293B] px-3 py-2 rounded-lg shadow-xl text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="font-semibold text-white">{item.name}</span>
                  </div>
                  <div className="text-slate-300">
                    {metricLabel}: <span className="font-bold text-white">{val.toLocaleString()}</span>
                  </div>
                  {item.operational !== undefined && (
                    <div className="text-[10px] text-emerald-400 mt-0.5">
                      Operational: <span className="font-bold">{item.operational.toLocaleString()}</span>
                    </div>
                  )}
                  {item.category && (
                    <div className="text-[10px] text-slate-400 mt-0.5">Category: {item.category}</div>
                  )}
                </div>
              );
            }
            return null;
          }}
        />
        <Bar 
          dataKey={(item) => item.count ?? item.users ?? 0}
          radius={[4, 4, 0, 0]}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}

export function ProjectAreaChart({ currentMonthly = 0 }: { currentMonthly?: number }) {
  const data = [
    { period: 'Jan', val: Math.round(currentMonthly * 0.65) },
    { period: 'Feb', val: Math.round(currentMonthly * 0.72) },
    { period: 'Mar', val: Math.round(currentMonthly * 0.78) },
    { period: 'Apr', val: Math.round(currentMonthly * 0.84) },
    { period: 'May', val: Math.round(currentMonthly * 0.89) },
    { period: 'Jun', val: Math.round(currentMonthly * 0.94) },
    { period: 'Jul', val: Math.round(currentMonthly * 0.97) },
    { period: 'Aug', val: currentMonthly },
  ];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsAreaChart data={data} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
        <defs>
          <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#A855F7" stopOpacity={0.6}/>
            <stop offset="95%" stopColor="#A855F7" stopOpacity={0.0}/>
          </linearGradient>
        </defs>
        <Tooltip 
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              return (
                <div className="bg-[#070D18] border border-[#1E293B] px-2.5 py-1.5 rounded-lg shadow-xl text-xs">
                  <div className="text-slate-400 text-[10px]">{payload[0].payload.period} 2026</div>
                  <div className="text-purple-300 font-bold font-mono mt-0.5">
                    {Number(payload[0].value).toLocaleString()} Txns
                  </div>
                </div>
              );
            }
            return null;
          }} 
        />
        <Area 
          type="monotone" 
          dataKey="val" 
          stroke="#A855F7" 
          strokeWidth={2.5} 
          fill="url(#colorTraffic)" 
        />
      </RechartsAreaChart>
    </ResponsiveContainer>
  );
}

export function ProjectDonutChart({ data = [] }: { data?: { name: string; short?: string; value: number; count?: number; color: string }[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-slate-500">
        No records
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie 
          data={data} 
          cx="50%" 
          cy="50%" 
          innerRadius={52} 
          outerRadius={74} 
          paddingAngle={3} 
          dataKey="value" 
          stroke="none"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip 
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const item = payload[0].payload;
              return (
                <div className="bg-[#070D18] border border-[#1E293B] px-3 py-1.5 rounded-lg shadow-xl text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-white">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.name}
                  </div>
                  <div className="text-slate-300 mt-0.5">
                    Records: <span className="font-bold text-white">{item.count ?? item.value}</span> ({item.value}%)
                  </div>
                </div>
              );
            }
            return null;
          }} 
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export { ProjectBarChart as BarChart, ProjectAreaChart as AreaChart, ProjectDonutChart as DonutChart };

