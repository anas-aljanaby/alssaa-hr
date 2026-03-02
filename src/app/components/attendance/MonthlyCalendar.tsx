import React from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import type { MonthlySummary } from '@/lib/services/attendance.service';
import { now } from '@/lib/time';

interface MonthlyCalendarProps {
  year: number;
  month: number;
  data: MonthlySummary[];
  onMonthChange: (year: number, month: number) => void;
  onDayTap: (date: string) => void;
}

export function MonthlyCalendar({
  year,
  month,
  data,
  onMonthChange,
  onDayTap,
}: MonthlyCalendarProps) {
  const monthNames = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
  ];

  const arabicDays = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س']; // Hijri days order in RTL

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  // Convert data to a map for quick lookup
  const dataMap = new Map(data.map((d) => [d.date, d]));

  const today = now();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDate = isCurrentMonth ? today.getDate() : null;

  const handlePrevMonth = () => {
    if (month === 0) {
      onMonthChange(year - 1, 11);
    } else {
      onMonthChange(year, month - 1);
    }
  };

  const handleNextMonth = () => {
    const nextMonth = new Date(year, month + 1);
    const maxDate = now();
    if (nextMonth <= maxDate) {
      if (month === 11) {
        onMonthChange(year + 1, 0);
      } else {
        onMonthChange(year, month + 1);
      }
    }
  };

  const canNavigateNext = () => {
    const nextMonth = new Date(year, month + 1);
    return nextMonth <= now();
  };

  const getStatusDot = (date: string) => {
    const summary = dataMap.get(date);
    if (!summary) return null;

    switch (summary.status) {
      case 'present':
        return 'bg-emerald-500';
      case 'late':
        return 'bg-amber-500';
      case 'absent':
        return 'bg-red-500';
      case 'on_leave':
        return 'bg-blue-500';
      default:
        return 'bg-gray-300';
    }
  };

  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm" dir="rtl">
      {/* Month/Year Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={handleNextMonth}
          disabled={!canNavigateNext()}
          className="p-2 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-white rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-gray-500" />
        </button>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600" />
          <span className="text-gray-800 font-semibold">
            {monthNames[month]} {year}
          </span>
        </div>

        <button
          onClick={handlePrevMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Day Headers (Arabic) */}
      <div className="grid grid-cols-7 gap-2 mb-4">
        {arabicDays.map((day) => (
          <div key={day} className="text-center text-xs font-semibold text-gray-500 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="aspect-square" />;
          }

          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isToday = todayDate === day;
          const statusDot = getStatusDot(dateStr);
          const hasData = dataMap.has(dateStr);

          return (
            <button
              key={day}
              onClick={() => {
                if (hasData) {
                  onDayTap(dateStr);
                }
              }}
              disabled={!hasData}
              className={`aspect-square flex flex-col items-center justify-center rounded-lg transition-colors relative group ${
                isToday
                  ? 'bg-blue-100 border-2 border-blue-500 font-semibold text-blue-700'
                  : hasData
                    ? 'bg-gray-50 hover:bg-gray-100 text-gray-800 cursor-pointer'
                    : 'text-gray-300'
              }`}
            >
              <span className="text-sm">{day}</span>
              {statusDot && (
                <div
                  className={`w-2 h-2 rounded-full mt-0.5 ${statusDot}`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
