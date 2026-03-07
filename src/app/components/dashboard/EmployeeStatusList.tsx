import React from 'react';
import { useNavigate } from 'react-router';
import { BarChart3 } from 'lucide-react';
import { getAttendanceStatusAr } from '../../data/mockData';
import { getStatusColor } from '@/lib/ui-helpers';
import type { Profile } from '@/lib/services/profiles.service';

export type EmployeeWithTodayStatus = Profile & {
  todayStatus: 'present' | 'late' | 'absent' | 'on_leave';
  checkIn: string | null;
  checkOut: string | null;
  autoPunchOut: boolean;
};

interface EmployeeStatusListProps {
  employees: EmployeeWithTodayStatus[];
  title?: string;
}

export function EmployeeStatusList({
  employees,
  title = 'حالة الموظفين اليوم',
}: EmployeeStatusListProps) {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-5 h-5 text-blue-500" />
        <h3 className="text-gray-800">{title}</h3>
      </div>
      <div className="space-y-2">
        {employees.map((emp) => (
          <div
            key={emp.id}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100"
            onClick={() => navigate(`/user-details/${emp.id}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') navigate(`/user-details/${emp.id}`);
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-sm text-blue-600">{emp.name_ar.charAt(0)}</span>
              </div>
              <div>
                <p className="text-sm text-gray-800">{emp.name_ar}</p>
                <p className="text-xs text-gray-400">
                  {emp.checkIn ? `الحضور: ${emp.checkIn}` : 'لم يسجل بعد'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {emp.autoPunchOut && (
                <span className="px-1.5 py-0.5 text-amber-600 bg-amber-100 rounded text-[10px] border border-amber-200">
                  انصراف تلقائي
                </span>
              )}
              <span className={`px-2.5 py-1 rounded-full text-xs ${getStatusColor(emp.todayStatus)}`}>
                {getAttendanceStatusAr(emp.todayStatus)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
