import React, { useEffect, useState } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/app/components/ui/drawer';
import { LogIn, LogOut, Clock } from 'lucide-react';
import type { DayRecord, PunchEntry } from '@/lib/services/attendance.service';
import { getAttendanceDay } from '@/lib/services/attendance.service';

interface Props {
  userId: string;
  date: string | null;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  present: 'حاضر',
  late: 'متأخر',
  absent: 'غائب',
  on_leave: 'إجازة',
};

const STATUS_COLORS: Record<string, string> = {
  present: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  late: 'bg-amber-100 text-amber-700 border-amber-200',
  absent: 'bg-red-100 text-red-700 border-red-200',
  on_leave: 'bg-blue-100 text-blue-700 border-blue-200',
};

function formatDateAr(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ar-IQ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(t: string): string {
  return t.slice(0, 5);
}

function PunchRow({ punch, isLast }: { punch: PunchEntry; isLast: boolean }) {
  const isIn = punch.type === 'clock_in';
  return (
    <div className="flex items-start gap-3 relative">
      {!isLast && (
        <div className="absolute right-[19px] top-7 bottom-0 w-0.5 bg-gray-100" />
      )}
      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
        isIn ? 'bg-emerald-100' : 'bg-rose-100'
      }`}>
        {isIn
          ? <LogIn className="w-4 h-4 text-emerald-600" />
          : <LogOut className="w-4 h-4 text-rose-500" />
        }
      </div>
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

export function DayDetailsSheet({ userId, date, onClose }: Props) {
  const [record, setRecord] = useState<DayRecord | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!date) return;
    setRecord(null);
    setLoading(true);
    getAttendanceDay(userId, date)
      .then(setRecord)
      .catch(() => setRecord(null))
      .finally(() => setLoading(false));
  }, [userId, date]);

  const open = !!date;

  return (
    <Drawer open={open} onOpenChange={(o) => { if (!o) onClose(); }} direction="bottom">
      <DrawerContent className="max-h-[85vh] overflow-y-auto">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-base text-right">
            {date ? formatDateAr(date) : ''}
          </DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-8">
          {loading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-5 bg-gray-100 rounded w-1/2" />
              <div className="h-4 bg-gray-100 rounded w-1/3" />
              <div className="h-12 bg-gray-100 rounded" />
              <div className="h-12 bg-gray-100 rounded" />
            </div>
          ) : record ? (
            <>
              {/* Shift */}
              {record.shift && (
                <p className="text-sm text-gray-500 mb-3">
                  الدوام: {formatTime(record.shift.workStartTime)} — {formatTime(record.shift.workEndTime)}
                </p>
              )}

              {/* Status + total hours */}
              <div className="flex items-center gap-3 mb-4">
                {record.log?.status && (
                  <span className={`px-2.5 py-1 text-xs rounded-full border ${STATUS_COLORS[record.log.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                    {STATUS_LABELS[record.log.status] ?? record.log.status}
                  </span>
                )}
                {record.totalMinutesWorked > 0 && (
                  <span className="text-sm text-gray-600">
                    إجمالي العمل: <span className="font-semibold">{Math.floor(record.totalMinutesWorked / 60)}س {record.totalMinutesWorked % 60}د</span>
                  </span>
                )}
              </div>

              {/* Punch log */}
              <h3 className="text-sm font-semibold text-gray-700 mb-3">سجل الحضور</h3>
              {record.punches.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <Clock className="w-8 h-8 mx-auto mb-1.5 opacity-40" />
                  <p className="text-sm">لا توجد بيانات لهذا اليوم</p>
                </div>
              ) : (
                <div>
                  {record.punches.map((punch, i) => (
                    <PunchRow
                      key={punch.id}
                      punch={punch}
                      isLast={i === record.punches.length - 1}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-6 text-gray-400">
              <p className="text-sm">تعذر تحميل البيانات</p>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
