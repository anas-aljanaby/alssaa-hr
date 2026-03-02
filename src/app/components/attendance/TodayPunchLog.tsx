import React from 'react';
import { LogIn, LogOut, Clock } from 'lucide-react';
import type { PunchEntry } from '@/lib/services/attendance.service';

interface Props {
  punches: PunchEntry[];
  isCheckedIn: boolean;
}

function formatTime(t: string): string {
  return t.slice(0, 5);
}

export function TodayPunchLog({ punches, isCheckedIn }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">سجل اليوم</h2>

      {punches.length === 0 && !isCheckedIn ? (
        <div className="text-center py-6 text-gray-400">
          <Clock className="w-8 h-8 mx-auto mb-1.5 opacity-40" />
          <p className="text-sm">لا يوجد تسجيلات لهذا اليوم</p>
        </div>
      ) : (
        <div className="space-y-0">
          {punches.map((punch, i) => (
            <PunchRow key={punch.id} punch={punch} isLast={i === punches.length - 1 && !isCheckedIn} />
          ))}
          {isCheckedIn && (
            <PendingPunchRow />
          )}
        </div>
      )}
    </div>
  );
}

function PunchRow({ punch, isLast }: { punch: PunchEntry; isLast: boolean }) {
  const isIn = punch.type === 'clock_in';
  return (
    <div className="flex items-start gap-3 relative">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute right-[19px] top-7 bottom-0 w-0.5 bg-gray-100" />
      )}
      {/* Icon */}
      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
        isIn ? 'bg-emerald-100' : 'bg-rose-100'
      }`}>
        {isIn
          ? <LogIn className="w-4 h-4 text-emerald-600" />
          : <LogOut className="w-4 h-4 text-rose-500" />
        }
      </div>
      {/* Content */}
      <div className="flex-1 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800">
              {formatTime(punch.timestamp)}
            </span>
            <span className="text-xs text-gray-500">
              {isIn ? '← تسجيل حضور' : '→ تسجيل انصراف'}
            </span>
          </div>
          {punch.isOvertime && (
            <span className="px-1.5 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 border border-blue-200">
              عمل إضافي
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function PendingPunchRow() {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-100 animate-pulse">
        <LogOut className="w-4 h-4 text-gray-400" />
      </div>
      <div className="flex-1 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-400 tabular-nums">--:--</span>
          <span className="text-xs text-gray-400">→ تسجيل انصراف (قيد الانتظار)</span>
        </div>
      </div>
    </div>
  );
}
