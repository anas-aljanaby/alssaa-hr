import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Users, Search } from 'lucide-react';
import { getAttendanceStatusAr } from '../../data/mockData';
import { getStatusColor } from '@/lib/ui-helpers';
import type { EmployeeWithTodayStatus } from './EmployeeStatusList';

const INITIAL_SHOW = 10;

interface EmployeeListUnifiedProps {
  employees: EmployeeWithTodayStatus[];
  lateCounts: Record<string, number>;
  absentCounts: Record<string, number>;
  title?: string;
}

export function EmployeeListUnified({
  employees,
  lateCounts,
  absentCounts,
  title = 'الموظفون',
}: EmployeeListUnifiedProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => e.name_ar.toLowerCase().includes(q));
  }, [employees, search]);

  const visible = expanded ? filtered : filtered.slice(0, INITIAL_SHOW);
  const hasMore = filtered.length > INITIAL_SHOW && !expanded;

  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-5 h-5 text-blue-500" />
        <h3 className="text-gray-800">{title}</h3>
      </div>

      <div className="relative mb-3">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم..."
          className="w-full pr-9 pl-3 py-2 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-200 outline-none transition-colors"
          aria-label="بحث عن موظف"
        />
      </div>

      <div className="space-y-2">
        {visible.map((emp) => {
          const lateCount = lateCounts[emp.id] || 0;
          const absentCount = absentCounts[emp.id] || 0;
          return (
            <div
              key={emp.id}
              className="flex items-center justify-between gap-2 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100"
              onClick={() => navigate(`/user-details/${emp.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ')
                  navigate(`/user-details/${emp.id}`);
              }}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-sm text-blue-600">{emp.name_ar.charAt(0)}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-gray-800 truncate">{emp.name_ar}</p>
                  <p className="text-xs text-gray-400">
                    {emp.checkIn ? `الحضور: ${emp.checkIn}` : 'لم يسجل بعد'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                {emp.autoPunchOut && (
                  <span className="px-1.5 py-0.5 text-amber-600 bg-amber-100 rounded text-[10px] border border-amber-200">
                    انصراف تلقائي
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] ${getStatusColor(emp.todayStatus)}`}
                >
                  {getAttendanceStatusAr(emp.todayStatus)}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${lateCount >= 3 ? 'bg-red-100 text-red-600' : 'bg-amber-50 text-amber-600'}`}
                  title="تأخر الشهر"
                >
                  تأخر: {lateCount}
                </span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600"
                  title="غياب الشهر"
                >
                  غياب: {absentCount}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">لا توجد نتائج</p>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 w-full py-2 text-sm text-blue-600 hover:text-blue-700 font-medium rounded-xl hover:bg-blue-50 transition-colors"
        >
          عرض المزيد ({filtered.length - INITIAL_SHOW} موظف)
        </button>
      )}
    </div>
  );
}
