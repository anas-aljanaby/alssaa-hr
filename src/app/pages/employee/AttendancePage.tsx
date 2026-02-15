import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { toast } from 'sonner';
import * as attendanceService from '@/lib/services/attendance.service';
import { getAttendanceStatusAr } from '../../data/mockData';
import type { AttendanceLog } from '@/lib/services/attendance.service';
import {
  LogIn,
  LogOut,
  MapPin,
  Clock,
  CheckCircle2,
  Calendar,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

export function AttendancePage() {
  const { currentUser } = useAuth();
  const { checkIn, checkOut } = useApp();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [todayLog, setTodayLog] = useState<AttendanceLog | null>(null);
  const [monthLogs, setMonthLogs] = useState<AttendanceLog[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const loadData = useCallback(async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      const [log, logs] = await Promise.all([
        attendanceService.getTodayLog(currentUser.uid),
        attendanceService.getMonthlyLogs(currentUser.uid, selectedYear, selectedMonth),
      ]);
      setTodayLog(log);
      setMonthLogs(logs);
    } catch {
      toast.error('فشل تحميل بيانات الحضور');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.uid, selectedMonth, selectedYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!currentUser) return null;

  const isCheckedIn = todayLog?.check_in_time && !todayLog?.check_out_time;
  const isCompleted = todayLog?.check_in_time && todayLog?.check_out_time;

  const getCoords = (): Promise<{ lat: number; lng: number } | undefined> =>
    new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(undefined);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(undefined),
        { timeout: 5000 }
      );
    });

  const handleCheckIn = async () => {
    setActionLoading(true);
    try {
      const coords = await getCoords();
      const result = await checkIn(currentUser.uid, coords);
      setTodayLog(result);
    } catch {
      /* toast handled by context */
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setActionLoading(true);
    try {
      const coords = await getCoords();
      const result = await checkOut(currentUser.uid, coords);
      setTodayLog(result);
    } catch {
      /* toast handled by context */
    } finally {
      setActionLoading(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'late': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'absent': return 'bg-red-100 text-red-700 border-red-200';
      case 'on_leave': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const statusDot = (status: string) => {
    switch (status) {
      case 'present': return 'bg-emerald-500';
      case 'late': return 'bg-amber-500';
      case 'absent': return 'bg-red-500';
      case 'on_leave': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const monthNames = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
  ];

  const prevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((prev) => prev - 1);
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
  };

  const nextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((prev) => prev + 1);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
  };

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-gray-800">الحضور والانصراف</h1>
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <Clock className="w-4 h-4" />
          <span>{currentTime}</span>
        </div>
      </div>

      {/* Check-in/Check-out Card */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center">
        <div
          className={`w-32 h-32 mx-auto rounded-full flex flex-col items-center justify-center mb-4 ${
            isCompleted
              ? 'bg-emerald-50 border-4 border-emerald-200'
              : isCheckedIn
                ? 'bg-blue-50 border-4 border-blue-200 animate-pulse'
                : 'bg-gray-50 border-4 border-gray-200'
          }`}
        >
          {isCompleted ? (
            <>
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-1" />
              <span className="text-xs text-emerald-600">اكتمل اليوم</span>
            </>
          ) : isCheckedIn ? (
            <>
              <Clock className="w-8 h-8 text-blue-500 mb-1" />
              <span className="text-xs text-blue-600">في العمل</span>
            </>
          ) : (
            <>
              <LogIn className="w-8 h-8 text-gray-400 mb-1" />
              <span className="text-xs text-gray-500">لم يتم التسجيل</span>
            </>
          )}
        </div>

        {todayLog?.check_in_time && (
          <div className="flex items-center justify-center gap-6 mb-4 text-sm">
            <div className="text-center">
              <p className="text-gray-400">الحضور</p>
              <p className="text-gray-800">{todayLog.check_in_time}</p>
            </div>
            {todayLog.check_out_time && (
              <div className="text-center">
                <p className="text-gray-400">الانصراف</p>
                <p className="text-gray-800">{todayLog.check_out_time}</p>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          {!todayLog?.check_in_time && (
            <button
              onClick={handleCheckIn}
              disabled={actionLoading}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <LogIn className="w-5 h-5" />
              {actionLoading ? 'جاري التسجيل...' : 'تسجيل الحضور'}
            </button>
          )}
          {isCheckedIn && (
            <button
              onClick={handleCheckOut}
              disabled={actionLoading}
              className="flex-1 py-3 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              {actionLoading ? 'جاري التسجيل...' : 'تسجيل الانصراف'}
            </button>
          )}
        </div>

        <div className="flex items-center justify-center gap-1.5 mt-3 text-xs text-gray-400">
          <MapPin className="w-3.5 h-3.5" />
          <span>سيتم تسجيل موقعك تلقائياً</span>
        </div>
      </div>

      {/* Month Selector */}
      <div className="flex items-center justify-between bg-white rounded-xl p-3 border border-gray-100">
        <button onClick={nextMonth} className="p-2 hover:bg-gray-50 rounded-lg">
          <ChevronRight className="w-5 h-5 text-gray-500" />
        </button>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600" />
          <span className="text-gray-800">
            {monthNames[selectedMonth]} {selectedYear}
          </span>
        </div>
        <button onClick={prevMonth} className="p-2 hover:bg-gray-50 rounded-lg">
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Attendance Records */}
      <div className="space-y-2">
        {loading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-16 animate-pulse" />
          ))
        ) : monthLogs.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>لا توجد سجلات لهذا الشهر</p>
          </div>
        ) : (
          monthLogs.map((log) => (
            <div
              key={log.id}
              className="bg-white rounded-xl p-3 border border-gray-100 flex items-center gap-3"
            >
              <div className={`w-2 h-10 rounded-full ${statusDot(log.status)}`} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-800">
                    {new Date(log.date).toLocaleDateString('ar-IQ', {
                      weekday: 'long',
                      day: 'numeric',
                    })}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs border ${statusColor(log.status)}`}
                  >
                    {getAttendanceStatusAr(log.status)}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  {log.check_in_time && <span>الحضور: {log.check_in_time}</span>}
                  {log.check_out_time && <span>الانصراف: {log.check_out_time}</span>}
                  {!log.check_in_time && !log.check_out_time && <span>—</span>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
