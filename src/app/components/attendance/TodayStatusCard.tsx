import { useEffect, useState } from 'react';
import { LogIn, LogOut, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  isOvertimeTime,
  totalWorkedMinutesToday,
  wallTimeHHMM,
  wallTimeToMinutes,
  type TodayRecord,
} from '@/lib/services/attendance.service';
import { useTodayPunchUi } from '../../hooks/useTodayPunchUi';
import { getStatusTheme } from './attendanceStatusTheme';
import { useBodyScrollLock } from '@/app/hooks/useBodyScrollLock';
import { DEFAULT_MINIMUM_OVERTIME_MINUTES } from '@/shared/attendance/constants';

interface Props {
  today: TodayRecord;
  actionLoading: boolean;
  onCheckIn: () => void;
  onCheckOut: (checkoutTime?: string) => void;
  /**
   * When true, the check-in / check-out buttons are visually disabled and a
   * short Arabic hint is shown. All writes require a live connection per
   * company policy.
   */
  isOffline?: boolean;
}

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatTime(t: string): string {
  return wallTimeHHMM(t) ?? '--:--';
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const isShortHex = normalized.length === 3;
  const expanded = isShortHex
    ? normalized.split('').map((ch) => ch + ch).join('')
    : normalized;

  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function todayArabicDate(): string {
  return new Date().toLocaleDateString('ar-IQ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function TodayStatusCard({ today, actionLoading, onCheckIn, onCheckOut, isOffline = false }: Props) {
  const { shift } = today;
  const overtimeColor = getStatusTheme('overtime').color;
  const overtimeClockColor = '#D97706';

  const [punchInElapsedSeconds, setPunchInElapsedSeconds] = useState(0);
  const [workdayElapsedSeconds, setWorkdayElapsedSeconds] = useState(0);
  const [confirmDialog, setConfirmDialog] = useState<'overtime' | null>(null);
  useBodyScrollLock(!!confirmDialog);

  const punchUi = useTodayPunchUi(today);
  const {
    isCheckedIn,
    activeCheckInWallTime: activeCheckInTime,
    isOvertimeNow: isOvertime,
    canPunchIn,
    showShiftCongrats,
  } = punchUi;

  const currentNow = new Date();

  // Real elapsed since punch-in (for the main clock and "hours worked")
  useEffect(() => {
    if (!isCheckedIn || !activeCheckInTime) {
      setPunchInElapsedSeconds(0);
      return;
    }
    const computePunchInElapsed = () => {
      const hm = wallTimeHHMM(activeCheckInTime);
      if (!hm) return 0;
      const [h, m] = hm.split(':').map(Number);
      const currentDate = new Date();
      const inMs = new Date(currentDate).setHours(h, m, 0, 0);
      return Math.max(0, Math.floor((currentDate.getTime() - inMs) / 1000));
    };
    setPunchInElapsedSeconds(computePunchInElapsed());
    const id = setInterval(() => setPunchInElapsedSeconds(computePunchInElapsed()), 1000);
    return () => clearInterval(id);
  }, [isCheckedIn, activeCheckInTime]);

  // Workday elapsed: for progress bar only, caps at shift duration
  useEffect(() => {
    if (!isCheckedIn || !shift) {
      setWorkdayElapsedSeconds(0);
      return;
    }
    const startM = toMinutes(shift.workStartTime);
    const endM = toMinutes(shift.workEndTime);
    const computeWorkdayElapsed = () => {
      const current = new Date();
      const currentMinutes = current.getHours() * 60 + current.getMinutes();
      const currentSeconds = current.getSeconds();
      if (currentMinutes < startM) return 0;
      if (currentMinutes >= endM) return (endM - startM) * 60;
      return (currentMinutes - startM) * 60 + currentSeconds;
    };
    setWorkdayElapsedSeconds(computeWorkdayElapsed());
    const id = setInterval(() => setWorkdayElapsedSeconds(computeWorkdayElapsed()), 1000);
    return () => clearInterval(id);
  }, [isCheckedIn, shift]);

  const currentMinutes = currentNow.getHours() * 60 + currentNow.getMinutes();
  const dayOfWeek = currentNow.getDay();

  const shiftStartMinutes = shift ? toMinutes(shift.workStartTime) : null;
  const shiftEndMinutes = shift ? toMinutes(shift.workEndTime) : null;
  const minimumOvertimeMinutes = shift?.minimumOvertimeMinutes ?? DEFAULT_MINIMUM_OVERTIME_MINUTES;
  const shiftDuration = shiftStartMinutes !== null && shiftEndMinutes !== null
    ? shiftEndMinutes - shiftStartMinutes
    : null;

  const isWorkingDay = shift ? !(shift.weeklyOffDays ?? [5, 6]).includes(dayOfWeek) : true;
  const isBeforeShift = shiftStartMinutes !== null && currentMinutes < shiftStartMinutes;
  const totalWorkedMin = totalWorkedMinutesToday(today);
  const activeSession = today.sessions?.find((session) => !session.check_out_time) ?? null;
  const orderedSessions = [...(today.sessions ?? [])].sort((a, b) =>
    a.check_in_time.localeCompare(b.check_in_time)
  );
  const firstCheckInTime = today.summary?.first_check_in ?? orderedSessions[0]?.check_in_time ?? null;
  const lastCheckOutTime =
    today.summary?.last_check_out ??
    [...orderedSessions].reverse().find((session) => !!session.check_out_time)?.check_out_time ??
    null;

  // Progress bar: 0-100%, caps at shift end
  const progressPercent = shiftDuration != null && shiftDuration > 0
    ? Math.min(100, (workdayElapsedSeconds / (shiftDuration * 60)) * 100)
    : 0;

  const activeSessionIsOvertime =
    activeSession?.is_overtime ??
    (isCheckedIn && !!activeCheckInTime && shift
      ? isOvertimeTime(wallTimeToMinutes(activeCheckInTime), shift, dayOfWeek)
      : false);

  // Time past shift end for an open regular session on a working day.
  const isPastShiftEnd = isCheckedIn && shiftEndMinutes !== null && currentMinutes > shiftEndMinutes;
  const postShiftElapsedSeconds = isPastShiftEnd
    ? Math.max(0, (currentMinutes - shiftEndMinutes!) * 60 + currentNow.getSeconds())
    : 0;
  const hasReachedLateStayOvertimeThreshold =
    isCheckedIn &&
    isPastShiftEnd &&
    isWorkingDay &&
    !activeSessionIsOvertime &&
    postShiftElapsedSeconds >= minimumOvertimeMinutes * 60;
  const overtimeElapsedSeconds = hasReachedLateStayOvertimeThreshold ? postShiftElapsedSeconds : 0;
  const pendingOvertimeSeconds =
    isCheckedIn &&
    isPastShiftEnd &&
    isWorkingDay &&
    !activeSessionIsOvertime &&
    !hasReachedLateStayOvertimeThreshold
      ? postShiftElapsedSeconds
      : 0;
  const remainingPendingOvertimeMinutes = Math.max(
    0,
    Math.ceil((minimumOvertimeMinutes * 60 - pendingOvertimeSeconds) / 60)
  );

  // Badge logic for first punch: check overtime first (matches service logic), then late
  const firstPunchIsOvertime =
    firstCheckInTime && shift
      ? isOvertimeTime(wallTimeToMinutes(firstCheckInTime), shift, dayOfWeek)
      : false;
  const firstPunchIsLate =
    firstCheckInTime && shift && !firstPunchIsOvertime
      ? wallTimeToMinutes(firstCheckInTime) > shiftStartMinutes! + shift.gracePeriodMinutes
      : false;

  const handleCheckInClick = () => {
    if (isOvertime) {
      setConfirmDialog('overtime');
    } else {
      onCheckIn();
    }
  };

  const handleConfirm = () => {
    setConfirmDialog(null);
    onCheckIn();
  };

  const buttonDisabled = actionLoading || isOffline;

  // Visual state for the clock circle
  const clockIsOvertime =
    isCheckedIn &&
    !!activeCheckInTime &&
    (hasReachedLateStayOvertimeThreshold ||
      !isWorkingDay ||
      activeSessionIsOvertime);

  return (
    <>
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        {/* Date and shift info */}
        <div className="text-center mb-4">
          <p className="text-sm text-gray-500">{todayArabicDate()}</p>
          {shift && (
            <p className="text-xs text-gray-400 mt-0.5">
              الدوام: {formatTime(shift.workStartTime)} — {formatTime(shift.workEndTime)}
            </p>
          )}
        </div>

        {/* Round clock: blue during regular hours, overtime color during overtime */}
        <div
          className={`w-28 h-28 mx-auto rounded-full flex flex-col items-center justify-center mb-5 ${
            !isCheckedIn && showShiftCongrats
              ? 'bg-[#0D9488]/10 border-4 border-[#0D9488]/20'
              : isCheckedIn && clockIsOvertime
                ? 'border-4 animate-pulse'
                : isCheckedIn
                  ? 'bg-blue-50 border-4 border-blue-200 animate-pulse'
                  : 'bg-gray-50 border-4 border-gray-200'
          }`}
          style={isCheckedIn && clockIsOvertime
            ? {
              backgroundColor: hexToRgba(overtimeClockColor, 0.1),
              borderColor: hexToRgba(overtimeClockColor, 0.3),
            }
            : undefined}
        >
          {!isCheckedIn && showShiftCongrats ? (
            <>
              <CheckCircle2 className="w-7 h-7 text-[#0D9488] mb-0.5" />
              <span className="text-xs text-[#0D9488] font-medium text-center leading-tight px-1">
                أحسنت
              </span>
              <span className="text-[10px] text-[#0D9488]/90 text-center leading-tight px-1 mt-0.5">
                استوفيت متطلبات الدوام
              </span>
            </>
          ) : isCheckedIn ? (
            <>
              <Clock className={`w-7 h-7 mb-0.5 ${clockIsOvertime ? '' : 'text-blue-500'}`} style={clockIsOvertime ? { color: overtimeClockColor } : undefined} />
              <span className={`text-xs font-mono tabular-nums font-semibold leading-tight ${clockIsOvertime ? '' : 'text-blue-700'}`} style={clockIsOvertime ? { color: overtimeClockColor } : undefined}>
                {formatElapsed(punchInElapsedSeconds)}
              </span>
              <span className={`text-xs ${clockIsOvertime ? '' : 'text-blue-500'}`} style={clockIsOvertime ? { color: overtimeClockColor } : undefined}>
                {clockIsOvertime ? 'عمل إضافي' : 'في العمل'}
              </span>
            </>
          ) : (
            <>
              <LogIn className="w-7 h-7 text-gray-400 mb-0.5" />
              <span className="text-xs text-gray-500">لم يتم التسجيل</span>
            </>
          )}
        </div>

        {/* Status badge for first punch */}
        {firstCheckInTime && (
          <div className="flex items-center justify-center gap-2 mb-4 text-sm">
            <div className="text-center">
              <p className="text-xs text-gray-400">الحضور</p>
              <div className="flex items-center gap-1.5">
                <p className="text-gray-800 font-medium">{formatTime(firstCheckInTime)}</p>
                {firstPunchIsOvertime ? (
                  <span
                    className="px-1.5 py-0.5 text-xs rounded-full border"
                    style={{
                      backgroundColor: hexToRgba(overtimeColor, 0.1),
                      color: overtimeColor,
                      borderColor: hexToRgba(overtimeColor, 0.2),
                    }}
                  >
                    عمل إضافي
                  </span>
                ) : firstPunchIsLate ? (
                  <span className="px-1.5 py-0.5 text-xs rounded-full bg-[#D97706]/10 text-[#D97706] border border-[#D97706]/20">متأخر</span>
                ) : (
                  <span className="px-1.5 py-0.5 text-xs rounded-full bg-[#0D9488]/10 text-[#0D9488] border border-[#0D9488]/20">في الوقت</span>
                )}
              </div>
            </div>
            {lastCheckOutTime && (
              <div className="text-center mr-4">
                <p className="text-xs text-gray-400">الانصراف</p>
                <p className="text-gray-800 font-medium">{formatTime(lastCheckOutTime)}</p>
              </div>
            )}
          </div>
        )}

        {/* Progress bar: workday completion only, caps at 100%. Hidden during pure overtime. */}
        {isCheckedIn && isWorkingDay && !activeSessionIsOvertime && shiftDuration != null && shiftDuration > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{Math.floor(workdayElapsedSeconds / 3600)}س {Math.floor((workdayElapsedSeconds % 3600) / 60)}د من الدوام</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Pending late-stay note before the overtime minimum is reached */}
        {pendingOvertimeSeconds > 0 && (
          <div className="text-center mb-4">
            <span className="text-sm text-amber-700">
              بعد نهاية الدوام: يتبقى <span className="font-semibold">{remainingPendingOvertimeMinutes} د</span> لبدء احتساب الإضافي
            </span>
          </div>
        )}

        {/* Overtime elapsed indicator when a regular open session has crossed the overtime minimum */}
        {isCheckedIn && hasReachedLateStayOvertimeThreshold && (
          <div className="text-center mb-4">
            <span className="text-sm" style={{ color: overtimeColor }}>
              عمل إضافي: <span className="font-semibold" style={{ color: overtimeColor }}>{formatElapsed(overtimeElapsedSeconds)}</span>
            </span>
          </div>
        )}

        {/* Hours worked: actual time since punch-in */}
        {isCheckedIn && (
          <div className="text-center mb-4">
            <span className="text-sm text-gray-600">
              ساعات العمل: <span className="font-semibold text-gray-800">{formatElapsed(punchInElapsedSeconds)}</span>
            </span>
          </div>
        )}

        {/* Total worked when not in an open session */}
        {!isCheckedIn && totalWorkedMin > 0 && (
          <div className="text-center mb-4">
            <span className="text-sm text-gray-600">
              إجمالي ساعات العمل:{' '}
              <span className="font-semibold text-gray-800">
                {Math.floor(totalWorkedMin / 60)}س {totalWorkedMin % 60}د
              </span>
            </span>
          </div>
        )}

        {/* Contextual notes */}
        {!isCheckedIn && isBeforeShift && !isOvertime && (
          <div className="flex items-center gap-1.5 justify-center mb-3 text-xs text-gray-400">
            <Clock className="w-3.5 h-3.5" />
            <span>لم يبدأ دوامك بعد</span>
          </div>
        )}
        {!isCheckedIn && isOvertime && (
          <div className="flex items-center gap-1.5 justify-center mb-3 text-xs text-amber-600">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>سيتم احتساب هذا كعمل إضافي وإنشاء طلب تلقائياً</span>
          </div>
        )}
        {!isCheckedIn && firstCheckInTime && firstPunchIsOvertime && (
          <div className="flex items-center gap-1.5 justify-center mb-3 text-xs" style={{ color: overtimeColor }}>
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>تم إنشاء طلب عمل إضافي تلقائياً بانتظار الموافقة</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-2">
          {!isCheckedIn && (
            <button
              onClick={handleCheckInClick}
              disabled={buttonDisabled || !canPunchIn}
              title={isOffline ? 'تحتاج إلى اتصال بالإنترنت لتسجيل الحضور' : undefined}
              aria-disabled={buttonDisabled || !canPunchIn}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-colors"
            >
              <LogIn className="w-5 h-5" />
              {actionLoading
                ? 'جاري التسجيل...'
                : isOffline
                  ? 'غير متصل — لا يمكن تسجيل الحضور'
                  : !canPunchIn
                    ? 'يمكنك التسجيل قبل ساعة من بدء الدوام'
                    : isOvertime
                      ? 'تسجيل الحضور (عمل إضافي)'
                      : 'تسجيل الحضور'}
            </button>
          )}
          {isCheckedIn && (
            <button
              onClick={() => onCheckOut()}
              disabled={actionLoading || isOffline}
              title={isOffline ? 'تحتاج إلى اتصال بالإنترنت لتسجيل الانصراف' : undefined}
              aria-disabled={actionLoading || isOffline}
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-colors"
            >
              <LogOut className="w-5 h-5" />
              {actionLoading
                ? 'جاري التسجيل...'
                : isOffline
                  ? 'غير متصل — لا يمكن تسجيل الانصراف'
                  : 'تسجيل الانصراف'}
            </button>
          )}
          {isOffline && (
            <p className="text-center text-[11px] text-amber-700">
              الاتصال بالإنترنت مطلوب لتسجيل الحضور والانصراف.
            </p>
          )}
        </div>
      </div>

      {/* Overtime Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl text-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ backgroundColor: hexToRgba(overtimeColor, 0.12) }}
            >
              <AlertTriangle className="w-6 h-6" style={{ color: overtimeColor }} />
            </div>
            <h3 className="text-gray-800 font-semibold mb-2">تأكيد عمل إضافي</h3>
            <p className="text-sm text-gray-500 mb-5">
              أنت خارج ساعات الدوام. سيتم تسجيل هذا كعمل إضافي وإنشاء طلب عمل إضافي تلقائياً بانتظار موافقة المدير. هل تريد المتابعة؟
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium"
              >
                متابعة
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
