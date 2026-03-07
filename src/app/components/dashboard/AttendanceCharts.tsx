import React from 'react';
import { Activity, TrendingUp, BarChart3 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Rectangle,
} from 'recharts';

const STACK_KEYS = ['حاضر', 'متأخر', 'غائب'] as const;

type GappedShapeProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: Record<string, unknown>;
  fill?: string;
};

function makeGappedShape(dataKey: (typeof STACK_KEYS)[number]) {
  return function GappedShape(props: unknown): React.ReactElement {
    const { x = 0, y = 0, width = 0, height = 0, payload, fill } = (props || {}) as GappedShapeProps;
    if (!width || width <= 0 || !height || height <= 0) return <g />;
    const vals = STACK_KEYS.map((k) => Number((payload as Record<string, number>)?.[k] ?? 0));
    const i = STACK_KEYS.indexOf(dataKey);
    if (!vals[i]) return <g />;
    const hasPrev = vals.slice(0, i).some((v) => v > 0);
    const SEG_GAP = 5;
    const nx = hasPrev ? x + SEG_GAP : x;
    const nw = hasPrev ? Math.max(0, width - SEG_GAP) : width;
    const r = Math.min(8, height / 2, nw / 2);
    return (
      <Rectangle
        x={nx}
        y={y}
        width={nw}
        height={height}
        fill={fill}
        radius={r}
      />
    );
  };
}

export type PieDataItem = { name: string; value: number; color: string };

export type WeeklyTrendItem = { day: string; حضور: number; تأخر: number };

export type DeptChartItem = { name: string; حاضر: number; متأخر: number; غائب: number };

interface AttendanceChartsProps {
  pieData: PieDataItem[];
  weeklyTrend: WeeklyTrendItem[];
  deptChartData?: DeptChartItem[];
}

export function AttendanceCharts({
  pieData,
  weeklyTrend,
  deptChartData,
}: AttendanceChartsProps) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-blue-500" />
          <h3 className="text-gray-800">توزيع الحضور اليوم</h3>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="45%"
                innerRadius={38}
                outerRadius={62}
                paddingAngle={3}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend
                content={({ payload }) => (
                  <div className="flex justify-center gap-5 pt-3 flex-wrap">
                    {payload?.map((entry) => (
                      <div key={entry.value} className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-sm shrink-0"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-xs text-gray-600">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-emerald-500" />
          <h3 className="text-gray-800">اتجاهات الأسبوع</h3>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={weeklyTrend}
              margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
              barSize={20}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} tickMargin={6} />
              <YAxis tick={{ fontSize: 11 }} width={28} tickMargin={4} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="حضور" fill="#059669" radius={[4, 4, 0, 0]} />
              <Bar dataKey="تأخر" fill="#d97706" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {deptChartData && deptChartData.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="w-5 h-5 text-indigo-500" />
            <h3 className="text-gray-800 font-medium">أداء الأقسام</h3>
          </div>
          <div className="h-60 min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={deptChartData}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 16, bottom: 8 }}
                barCategoryGap="12%"
                barSize={20}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e5e7eb"
                  vertical={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickMargin={8}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickLine={false}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  orientation="right"
                  width={80}
                  tick={{ fontSize: 12, fill: '#374151' }}
                  tickMargin={8}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Legend
                  content={({ payload }) => (
                    <div className="flex justify-center gap-6 pt-4 flex-wrap">
                      {payload?.map((entry) => (
                        <div key={entry.value} className="flex items-center gap-2">
                          <div
                            className="w-3.5 h-3.5 rounded-md shrink-0"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className="text-sm text-gray-600">{entry.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                />
                <Bar
                  dataKey="حاضر"
                  fill="#059669"
                  stackId="a"
                  shape={makeGappedShape('حاضر')}
                />
                <Bar
                  dataKey="متأخر"
                  fill="#d97706"
                  stackId="a"
                  shape={makeGappedShape('متأخر')}
                />
                <Bar
                  dataKey="غائب"
                  fill="#dc2626"
                  stackId="a"
                  shape={makeGappedShape('غائب')}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
