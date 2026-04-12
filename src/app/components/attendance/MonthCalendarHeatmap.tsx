import { ChevronRight, ChevronLeft, Calendar } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { MonthDaySummary } from '@/lib/services/attendance.service';
import { CALENDAR_LEGEND_STATUSES, getCalendarDotClass, getStatusTheme } from './attendanceStatusTheme';

interface Props {
  year: number;
  month: number;
  summaries: MonthDaySummary[];
  loading: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onDayTap: (date: string) => void;
}

const MONTH_NAMES = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

// Arabic day abbreviations, Sunday-first
const DAY_HEADERS = ['أح', 'إث', 'ثل', 'أر', 'خم', 'جم', 'سب'];

export function MonthCalendarHeatmap({ year, month, summaries, loading, onPrevMonth, onNextMonth, onDayTap }: Props) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const todayDate = today.getDate();

  const isCurrentMonth = year === currentYear && month === currentMonth;
  const isFutureMonth = year > currentYear || (year === currentYear && month > currentMonth);

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const summaryMap = new Map(summaries.map((s) => [s.date, s]));
  const overtimeMarkerColor = getStatusTheme('overtime_offday').color;

  const cells: (number | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onNextMonth}
          className="p-1.5 hover:bg-gray-50 rounded-lg transition-colors"
          aria-label="الشهر التالي"
          disabled={isCurrentMonth || isFutureMonth}
        >
          <ChevronRight className={`w-5 h-5 ${isCurrentMonth || isFutureMonth ? 'text-gray-200' : 'text-gray-500'}`} />
        </button>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-semibold text-gray-800">
            {MONTH_NAMES[month]} {year}
          </span>
        </div>
        <button
          onClick={onPrevMonth}
          className="p-1.5 hover:bg-gray-50 rounded-lg transition-colors"
          aria-label="الشهر السابق"
        >
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_HEADERS.map((d) => (
          <div key={d} className="text-center text-xs text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      {loading ? (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;

            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const summary = summaryMap.get(dateStr);
            const isToday = isCurrentMonth && day === todayDate;
            const isFutureDay = summary?.status === 'future';
            const isWeekend = summary?.status === 'weekend';
            const isOvertimeOffday = summary?.status === 'overtime_offday';
            const dot = summary ? getCalendarDotClass(summary.status) : null;
            const isTappable = !isFutureDay && summary?.status !== 'weekend' && summary?.status != null;

            return (
              <button
                key={dateStr}
                onClick={() => isTappable && onDayTap(dateStr)}
                disabled={!isTappable}
                className={`flex flex-col items-center justify-center aspect-square rounded-lg transition-colors relative ${
                  isToday
                    ? 'bg-blue-600 text-white'
                    : isWeekend || isFutureDay
                      ? 'text-gray-300'
                      : isTappable
                        ? 'hover:bg-gray-50 text-gray-700 active:bg-gray-100'
                        : 'text-gray-300'
                }`}
              >
                <span className={`text-xs font-medium leading-none mb-0.5 ${isToday ? 'text-white' : ''}`}>
                  {day}
                </span>
                {dot && !isToday && (
                  <span className="w-1.5 h-1.5 rounded-full" style={dot} />
                )}
                {isToday && dot && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
                )}
                {isOvertimeOffday && !isToday && (
                  <span
                    className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full border"
                    style={{
                      backgroundColor: overtimeMarkerColor,
                      borderColor: overtimeMarkerColor,
                      opacity: 0.25,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 justify-center">
        {CALENDAR_LEGEND_STATUSES.map((statusKey) => (
          <LegendItem
            key={statusKey}
            dotStyle={getStatusTheme(statusKey).dotStyle}
            label={getStatusTheme(statusKey).label}
          />
        ))}
      </div>
    </div>
  );
}

function LegendItem({ dotStyle, label }: { dotStyle: CSSProperties; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="w-2 h-2 rounded-full" style={dotStyle} />
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}
