import React, { useState, useEffect } from 'react';
import { X, Loader2, LogIn, LogOut } from 'lucide-react';
import * as attendanceService from '@/lib/services/attendance.service';
import type { DayRecord } from '@/lib/services/attendance.service';

interface DayDetailsSheetProps {
  userId: string;
  date: string;
  isOpen: boolean;
  onClose: () => void;
}

export function DayDetailsSheet({
  userId,
  date,
  isOpen,
  onClose,
}: DayDetailsSheetProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<DayRecord | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setRecord(null);
      setError(null);
      return;
    }

    const loadDay = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await attendanceService.getAttendanceDay(userId, date);
        setRecord(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'فشل تحميل التفاصيل');
      } finally {
        setLoading(false);
      }
    };

    loadDay();
  }, [isOpen, userId, date]);

  if (!isOpen) return null;

  const displayDate = new Date(date + 'T00:00:00').toLocaleDateString('ar-IQ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-lg z-50 max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom"
        dir="rtl"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">{displayDate}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-gray-500 text-sm mt-2">جاري التحميل...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
              {error}
            </div>
          )}

          {record && (
            <div className="space-y-4">
              {/* Shift Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-2">الدوام</p>
                <p className="text-gray-800 font-semibold">
                  {record.shiftStart} — {record.shiftEnd}
                </p>
              </div>

              {/* Status Badge */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-2">الحالة</p>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      record.log.status === 'present'
                        ? 'bg-emerald-500'
                        : record.log.status === 'late'
                          ? 'bg-amber-500'
                          : record.log.status === 'absent'
                            ? 'bg-red-500'
                            : 'bg-blue-500'
                    }`}
                  />
                  <p className="text-gray-800">
                    {record.log.status === 'present'
                      ? 'حاضر'
                      : record.log.status === 'late'
                        ? 'متأخر'
                        : record.log.status === 'absent'
                          ? 'غائب'
                          : 'في إجازة'}
                  </p>
                </div>
              </div>

              {/* Total Hours */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-2">إجمالي الساعات</p>
                <p className="text-gray-800 font-semibold text-lg">
                  {record.totalHoursWorked.toFixed(1)} ساعة
                </p>
              </div>

              {/* Punch Log */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-800">سجل التسجيلات</h3>
                {record.punches.length === 0 ? (
                  <p className="text-gray-400 text-sm">لا يوجد تسجيلات</p>
                ) : (
                  <div className="space-y-2">
                    {record.punches.map((punch, index) => (
                      <div
                        key={punch.id}
                        className="flex items-center gap-4 pb-2"
                        style={{
                          borderBottom: index < record.punches.length - 1 ? '1px solid #e5e7eb' : 'none',
                        }}
                      >
                        <div className="flex-shrink-0 text-gray-400">
                          {punch.type === 'clock_in' ? (
                            <LogIn className="w-5 h-5" />
                          ) : (
                            <LogOut className="w-5 h-5" />
                          )}
                        </div>

                        <div className="font-tabular-nums font-semibold text-gray-800 w-16">
                          {punch.timestamp}
                        </div>

                        <div className="flex-1">
                          <p className="text-sm text-gray-600">
                            {punch.type === 'clock_in' ? 'تسجيل حضور' : 'تسجيل انصراف'}
                          </p>
                        </div>

                        {punch.isOvertime && (
                          <div className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                            عمل إضافي
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
