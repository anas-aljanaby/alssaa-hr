import React from 'react';
import { LogIn, LogOut } from 'lucide-react';
import type { PunchEntry } from '@/lib/services/attendance.service';

interface TodayPunchLogProps {
  punches: PunchEntry[];
  isCheckedIn: boolean;
}

export function TodayPunchLog({ punches, isCheckedIn }: TodayPunchLogProps) {
  if (punches.length === 0 && !isCheckedIn) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center" dir="rtl">
        <p className="text-gray-400">لا يوجد تسجيلات لهذا اليوم</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm" dir="rtl">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">سجل اليوم</h2>

      <div className="space-y-3">
        {punches.map((punch, index) => (
          <div
            key={punch.id}
            className="flex items-center gap-4 pb-3"
            style={{
              borderBottom: index < punches.length - 1 || isCheckedIn ? '1px solid #e5e7eb' : 'none',
            }}
          >
            {/* Arrow Icon */}
            <div className="flex-shrink-0 text-gray-400">
              {punch.type === 'clock_in' ? (
                <LogIn className="w-5 h-5" />
              ) : (
                <LogOut className="w-5 h-5" />
              )}
            </div>

            {/* Time */}
            <div className="font-tabular-nums font-semibold text-gray-800 w-16">
              {punch.timestamp}
            </div>

            {/* Label */}
            <div className="flex-1">
              <p className="text-sm text-gray-600">
                {punch.type === 'clock_in' ? '→ تسجيل حضور' : '← تسجيل انصراف'}
              </p>
            </div>

            {/* Overtime Tag */}
            {punch.isOvertime && (
              <div className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                عمل إضافي
              </div>
            )}
          </div>
        ))}

        {/* Pending Checkout Row */}
        {isCheckedIn && punches.some((p) => p.type === 'clock_in') && !punches.some((p) => p.type === 'clock_out') && (
          <div className="flex items-center gap-4 pt-2 border-t border-gray-200">
            <div className="flex-shrink-0 text-gray-300">
              <LogOut className="w-5 h-5" />
            </div>

            <div className="font-tabular-nums text-gray-400 w-16">
              --:--
            </div>

            <div className="flex-1">
              <p className="text-sm text-gray-400">← تسجيل انصراف (قيد الانتظار)</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
