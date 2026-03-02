import React, { useState, useEffect } from 'react';
import { LogIn, LogOut, MapPin, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import type { TodayRecord } from '@/lib/services/attendance.service';
import { now } from '@/lib/time';

interface TodayStatusCardProps {
  record: TodayRecord;
  onCheckIn: () => void;
  onCheckOut: () => void;
  isLoading: boolean;
  onShowOvertime?: () => void;
  onShowEarlyCheckout?: () => void;
}

export function TodayStatusCard({
  record,
  onCheckIn,
  onCheckOut,
  isLoading,
  onShowOvertime,
  onShowEarlyCheckout,
}: TodayStatusCardProps) {
  const [elapsed, setElapsed] = useState<string>('00:00:00');

  useEffect(() => {
    if (!record.isCheckedIn || !record.log?.check_in_time) return;

    const updateTimer = () => {
      const [inH, inM, inS] = (record.log!.check_in_time || '00:00:00').split(':').map(Number);
      const checkInTime = new Date();
      checkInTime.setHours(inH, inM, inS);

      const currentTime = now();
      const diffMs = currentTime.getTime() - checkInTime.getTime();
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      setElapsed(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [record.isCheckedIn, record.log?.check_in_time]);

  const todayDate = now().toLocaleDateString('ar-IQ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const currentTime = `${String(now().getHours()).padStart(2, '0')}:${String(now().getMinutes()).padStart(2, '0')}`;

  // Status badge logic
  let statusBadgeText = '';
  let statusBadgeColor = '';
  if (!record.log?.check_in_time) {
    statusBadgeText = 'لم يتم التسجيل';
  } else if (record.isCompleted) {
    statusBadgeText = 'اكتمل اليوم';
  } else {
    statusBadgeText = 'في العمل';
  }

  // Check if shift hasn't started yet
  const [shiftH, shiftM] = record.shiftStart.split(':').map(Number);
  const shiftStartMinutes = shiftH * 60 + shiftM;
  const nowMinutes = now().getHours() * 60 + now().getMinutes();
  const shiftNotStarted = nowMinutes < shiftStartMinutes;

  // Check for overtime warning (clock in after shift end)
  const [endH, endM] = record.shiftEnd.split(':').map(Number);
  const shiftEndMinutes = endH * 60 + endM;
  const wouldBeOvertime = nowMinutes > shiftEndMinutes;

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center space-y-4" dir="rtl">
      {/* Date and Time */}
      <div className="space-y-2">
        <p className="text-sm text-gray-600">{todayDate}</p>
        <p className="text-sm text-gray-500">الدوام: {record.shiftStart} — {record.shiftEnd}</p>
      </div>

      {/* Pulsing Round Clock Circle */}
      <div
        className={`w-28 h-28 mx-auto rounded-full flex flex-col items-center justify-center transition-all ${
          record.isCompleted
            ? 'bg-emerald-50 border-4 border-emerald-200'
            : record.isCheckedIn
              ? 'bg-blue-50 border-4 border-blue-200 animate-pulse'
              : 'bg-gray-50 border-4 border-gray-200'
        }`}
      >
        {record.isCompleted ? (
          <>
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-1" />
            <span className="text-xs text-emerald-600">اكتمل اليوم</span>
          </>
        ) : record.isCheckedIn ? (
          <>
            <Clock className="w-8 h-8 text-blue-500 mb-1" />
            <span className="text-xs text-blue-600 font-tabular-nums">{elapsed}</span>
          </>
        ) : (
          <>
            <LogIn className="w-8 h-8 text-gray-400 mb-1" />
            <span className="text-xs text-gray-500">لم يتم التسجيل</span>
          </>
        )}
      </div>

      {/* Warnings and Notes */}
      <div className="space-y-2">
        {shiftNotStarted && !record.log?.check_in_time && (
          <div className="flex items-center gap-2 bg-blue-50 text-blue-700 text-xs p-2 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>لم يبدأ دوامك بعد</span>
          </div>
        )}

        {wouldBeOvertime && !record.log?.check_in_time && (
          <div className="flex items-center gap-2 bg-amber-50 text-amber-700 text-xs p-2 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>سيتم احتساب هذا كعمل إضافي</span>
          </div>
        )}
      </div>

      {/* Check In/Out Times */}
      {record.log?.check_in_time && (
        <div className="flex items-center justify-center gap-6 text-sm">
          <div className="text-center">
            <p className="text-gray-400">الحضور</p>
            <p className="text-gray-800 font-tabular-nums">{record.log.check_in_time}</p>
          </div>
          {record.log.check_out_time && (
            <div className="text-center">
              <p className="text-gray-400">الانصراف</p>
              <p className="text-gray-800 font-tabular-nums">{record.log.check_out_time}</p>
            </div>
          )}
        </div>
      )}

      {/* Progress Bar for In-Shift */}
      {record.isCheckedIn && record.log?.check_in_time && (
        <div className="space-y-2">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{
                width: `${Math.min(
                  ((now().getHours() * 60 + now().getMinutes()) -
                    (parseInt(record.shiftStart.split(':')[0]) * 60 +
                      parseInt(record.shiftStart.split(':')[1]))) /
                    ((parseInt(record.shiftEnd.split(':')[0]) * 60 +
                      parseInt(record.shiftEnd.split(':')[1])) -
                      (parseInt(record.shiftStart.split(':')[0]) * 60 +
                        parseInt(record.shiftStart.split(':')[1]))) *
                      100,
                  100
                )}%`,
              }}
            />
          </div>
          <p className="text-xs text-gray-500">
            {record.totalHoursWorked ? `${record.totalHoursWorked.toFixed(1)} ساعات` : 'جاري العد'}
          </p>
        </div>
      )}

      {/* Total Hours for Completed */}
      {record.isCompleted && record.totalHoursWorked && (
        <div className="text-sm">
          <p className="text-gray-600">إجمالي الساعات</p>
          <p className="text-gray-800 font-semibold">{record.totalHoursWorked.toFixed(1)} ساعة</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2">
        {!record.log?.check_in_time && (
          <button
            onClick={() => {
              if (wouldBeOvertime && onShowOvertime) {
                onShowOvertime();
              } else {
                onCheckIn();
              }
            }}
            disabled={isLoading}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <LogIn className="w-5 h-5" />
            {isLoading ? 'جاري التسجيل...' : 'تسجيل الحضور'}
          </button>
        )}
        {record.isCheckedIn && (
          <button
            onClick={() => {
              const earlyCheckout =
                (now().getHours() * 60 + now().getMinutes()) <
                (shiftEndMinutes - 60);
              if (earlyCheckout && onShowEarlyCheckout) {
                onShowEarlyCheckout();
              } else {
                onCheckOut();
              }
            }}
            disabled={isLoading}
            className="flex-1 py-3 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            {isLoading ? 'جاري التسجيل...' : 'تسجيل الانصراف'}
          </button>
        )}
      </div>

      {/* Location Note */}
      <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
        <MapPin className="w-3.5 h-3.5" />
        <span>سيتم تسجيل موقعك تلقائياً</span>
      </div>
    </div>
  );
}
