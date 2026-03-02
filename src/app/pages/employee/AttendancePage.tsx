import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { toast } from 'sonner';
import * as attendanceService from '@/lib/services/attendance.service';
import type { TodayRecord, MonthlySummary } from '@/lib/services/attendance.service';
import { now } from '@/lib/time';
import { TodayStatusCard } from '../../components/attendance/TodayStatusCard';
import { TodayPunchLog } from '../../components/attendance/TodayPunchLog';
import { MonthlyCalendar } from '../../components/attendance/MonthlyCalendar';
import { DayDetailsSheet } from '../../components/attendance/DayDetailsSheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';

export function AttendancePage() {
  const { currentUser } = useAuth();
  const { checkIn, checkOut } = useApp();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [todayRecord, setTodayRecord] = useState<TodayRecord | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(now().getMonth());
  const [selectedYear, setSelectedYear] = useState(now().getFullYear());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showDaySheet, setShowDaySheet] = useState(false);
  const [showOvertimeConfirm, setShowOvertimeConfirm] = useState(false);
  const [showEarlyCheckoutConfirm, setShowEarlyCheckoutConfirm] = useState(false);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [actionDisabledUntil, setActionDisabledUntil] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      const [today, monthly] = await Promise.all([
        attendanceService.getAttendanceToday(currentUser.uid),
        attendanceService.getAttendanceMonthlyWithSummary(currentUser.uid, selectedYear, selectedMonth),
      ]);
      setTodayRecord(today);
      setMonthlySummary(monthly);
    } catch {
      toast.error('فشل تحميل بيانات الحضور');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.uid, selectedMonth, selectedYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle visibility changes to refresh data
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadData]);

  // Cooldown timer
  useEffect(() => {
    if (actionDisabledUntil === null) return;

    const timer = setInterval(() => {
      setActionDisabledUntil((prev) => {
        if (prev === null || Date.now() >= prev) {
          clearInterval(timer);
          return null;
        }
        return prev;
      });
    }, 100);

    return () => clearInterval(timer);
  }, [actionDisabledUntil]);

  if (!currentUser) return null;

  const getCoords = (): Promise<{ lat: number; lng: number } | undefined> =>
    new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(undefined);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {
          toast.warning('تعذر الحصول على موقعك، سيتم التسجيل بدونه');
          resolve(undefined);
        },
        { timeout: 5000 }
      );
    });

  const isButtonDisabled = actionLoading || (actionDisabledUntil !== null && Date.now() < actionDisabledUntil);

  const handleCheckIn = async (skipConfirm = false) => {
    if (isButtonDisabled) return;

    const [endH, endM] = (todayRecord?.shiftEnd ?? '16:00').split(':').map(Number);
    const shiftEndMinutes = endH * 60 + endM;
    const nowMinutes = now().getHours() * 60 + now().getMinutes();
    const wouldBeOvertime = nowMinutes > shiftEndMinutes;

    if (wouldBeOvertime && !skipConfirm) {
      setShowOvertimeConfirm(true);
      return;
    }

    setActionLoading(true);
    try {
      const coords = await getCoords();
      const result = await checkIn(currentUser.uid, coords);
      const updated = await attendanceService.getAttendanceToday(currentUser.uid);
      setTodayRecord(updated);
      setActionDisabledUntil(Date.now() + 60000); // 60 second cooldown
      setShowOvertimeConfirm(false);
    } catch {
      /* toast handled by context */
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async (skipConfirm = false) => {
    if (isButtonDisabled) return;

    const [endH, endM] = (todayRecord?.shiftEnd ?? '16:00').split(':').map(Number);
    const shiftEndMinutes = endH * 60 + endM;
    const nowMinutes = now().getHours() * 60 + now().getMinutes();
    const earlyCheckout = nowMinutes < shiftEndMinutes - 60;

    if (earlyCheckout && !skipConfirm) {
      setShowEarlyCheckoutConfirm(true);
      return;
    }

    setActionLoading(true);
    try {
      const coords = await getCoords();
      const result = await checkOut(currentUser.uid, coords);
      const updated = await attendanceService.getAttendanceToday(currentUser.uid);
      setTodayRecord(updated);
      setActionDisabledUntil(Date.now() + 60000); // 60 second cooldown
      setShowEarlyCheckoutConfirm(false);
      
      // Optional vibration feedback
      if (navigator.vibrate) {
        navigator.vibrate([50, 30, 50]);
      }
    } catch {
      /* toast handled by context */
    } finally {
      setActionLoading(false);
    }
  };

  const handleDayTap = (date: string) => {
    setSelectedDay(date);
    setShowDaySheet(true);
  };

  const cooldownRemaining = actionDisabledUntil ? Math.max(0, Math.ceil((actionDisabledUntil - Date.now()) / 1000)) : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4" dir="rtl">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pt-2">
          <h1 className="text-xl font-semibold text-gray-800">الحضور والانصراف</h1>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-6 border border-gray-100 h-80 animate-pulse" />
            <div className="bg-white rounded-2xl p-6 border border-gray-100 h-32 animate-pulse" />
            <div className="bg-white rounded-2xl p-6 border border-gray-100 h-64 animate-pulse" />
          </div>
        ) : todayRecord ? (
          <>
            {/* Section 1: Today's Status Card */}
            <TodayStatusCard
              record={todayRecord}
              onCheckIn={() => handleCheckIn()}
              onCheckOut={() => handleCheckOut()}
              isLoading={isButtonDisabled}
              onShowOvertime={() => setShowOvertimeConfirm(true)}
              onShowEarlyCheckout={() => setShowEarlyCheckoutConfirm(true)}
            />

            {/* Cooldown Message */}
            {cooldownRemaining > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center text-sm text-blue-700">
                يرجى الانتظار {cooldownRemaining} ثانية قبل المحاولة مجدداً
              </div>
            )}

            {/* Section 2: Today's Punch Log */}
            <TodayPunchLog
              punches={todayRecord.punches}
              isCheckedIn={todayRecord.isCheckedIn}
            />

            {/* Section 3: Monthly Calendar */}
            <MonthlyCalendar
              year={selectedYear}
              month={selectedMonth}
              data={monthlySummary}
              onMonthChange={(y, m) => {
                setSelectedYear(y);
                setSelectedMonth(m);
              }}
              onDayTap={handleDayTap}
            />
          </>
        ) : (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center text-gray-500">
            فشل تحميل البيانات
          </div>
        )}
      </div>

      {/* Confirmation Dialogs */}
      <AlertDialog open={showOvertimeConfirm} onOpenChange={setShowOvertimeConfirm}>
        <AlertDialogContent dir="rtl">
          <AlertDialogTitle>تحذير: عمل إضافي</AlertDialogTitle>
          <AlertDialogDescription>
            أنت خارج ساعات الدوام. سيتم تسجيل هذا كعمل إضافي. هل تريد المتابعة؟
          </AlertDialogDescription>
          <div className="flex gap-3 flex-row-reverse">
            <AlertDialogAction onClick={() => handleCheckIn(true)}>
              نعم، تابع
            </AlertDialogAction>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showEarlyCheckoutConfirm} onOpenChange={setShowEarlyCheckoutConfirm}>
        <AlertDialogContent dir="rtl">
          <AlertDialogTitle>تحذير: انصراف مبكر</AlertDialogTitle>
          <AlertDialogDescription>
            أنت تغادر قبل نهاية الدوام بأكثر من ساعة. هل تريد المتابعة؟
          </AlertDialogDescription>
          <div className="flex gap-3 flex-row-reverse">
            <AlertDialogAction onClick={() => handleCheckOut(true)}>
              نعم، تابع
            </AlertDialogAction>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Day Details Sheet */}
      {selectedDay && (
        <DayDetailsSheet
          userId={currentUser.uid}
          date={selectedDay}
          isOpen={showDaySheet}
          onClose={() => {
            setShowDaySheet(false);
            setSelectedDay(null);
          }}
        />
      )}
    </div>
  );
}
