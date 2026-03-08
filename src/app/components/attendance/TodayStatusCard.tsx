import { useEffect, useState } from 'react';
import { LogIn, LogOut, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { TodayRecord } from '@/lib/services/attendance.service';
import { now } from '@/lib/time';

interface Props {
  today: TodayRecord;
  actionLoading: boolean;
  cooldownSecondsLeft: number;
  onCheckIn: () => void;
  onCheckOut: (checkoutTime?: string) => void;
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
  return t.slice(0, 5);
}

function todayArabicDate(): string {
  return now().toLocaleDateString('ar-IQ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function TodayStatusCard({ today, actionLoading, cooldownSecondsLeft, onCheckIn, onCheckOut }: Props) {
  const { log, shift } = today;

  // Workday elapsed: 0 until shift start, then time from shift start to min(now, shift end). For progress bar only.
  const [workdayElapsedSeconds, setWorkdayElapsedSeconds] = useState(0);
  // Hours worked: actual time since punch-in (where late arrival shows up).
  const [punchInElapsedSeconds, setPunchInElapsedSeconds] = useState(0);
  const [confirmDialog, setConfirmDialog] = useState<'overtime' | 'early_checkout' | null>(null);

  const isCheckedIn = !!(log?.check_in_time && !log?.check_out_time);
  const isCompleted = !!(log?.check_in_time && log?.check_out_time);

  useEffect(() => {
    if (!isCheckedIn || !shift) {
      setWorkdayElapsedSeconds(0);
      return;
    }
    const startM = toMinutes(shift.workStartTime);
    const endM = toMinutes(shift.workEndTime);
    const computeWorkdayElapsed = () => {
      const current = now();
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

  useEffect(() => {
    if (!isCheckedIn || !log?.check_in_time) {
      setPunchInElapsedSeconds(0);
      return;
    }
    const computePunchInElapsed = () => {
      const [h, m] = log.check_in_time!.split(':').map(Number);
      const currentDate = now();
      const inMs = new Date(currentDate).setHours(h, m, 0, 0);
      return Math.max(0, Math.floor((currentDate.getTime() - inMs) / 1000));
    };
    setPunchInElapsedSeconds(computePunchInElapsed());
    const id = setInterval(() => setPunchInElapsedSeconds(computePunchInElapsed()), 1000);
    return () => clearInterval(id);
  }, [isCheckedIn, log?.check_in_time]);

  // Tick every second so current time (and isOvertime / isBeforeShift) stays in sync with dev or real clock
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!shift) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [shift]);

  const currentNow = now();
  const currentMinutes = currentNow.getHours() * 60 + currentNow.getMinutes();
  const dayOfWeek = currentNow.getDay(); // 0 = Sun, 5 = Fri, 6 = Sat

  const shiftStartMinutes = shift ? toMinutes(shift.workStartTime) : null;
  const shiftEndMinutes = shift ? toMinutes(shift.workEndTime) : null;
  const shiftDuration = shiftStartMinutes !== null && shiftEndMinutes !== null
    ? shiftEndMinutes - shiftStartMinutes
    : null;

  // Timer: workday elapsed (0 until shift start)
  const displayElapsedSeconds = isCheckedIn && shift ? workdayElapsedSeconds : 0;

  // Progress bar: time-based only, 100% at shift end. progress = (currentTime - shiftStart) / (shiftEnd - shiftStart) * 100
  const progressPercent = shiftDuration != null && shiftDuration > 0
    ? Math.min(100, (workdayElapsedSeconds / (shiftDuration * 60)) * 100)
    : 0;

  // Hours worked: actual time since punch-in (late arrival shows up here). When completed = check_out - check_in.
  const hoursWorkedSeconds = isCheckedIn
    ? punchInElapsedSeconds
    : isCompleted && log?.check_in_time && log?.check_out_time
      ? (toMinutes(log.check_out_time) - toMinutes(log.check_in_time)) * 60
      : 0;
  const workedMinutes = Math.floor(hoursWorkedSeconds / 60);

  const bufferMinutes = shift?.bufferMinutesAfterShift ?? 30;
  const isWorkingDay = shift ? !(shift.weeklyOffDays ?? [5, 6]).includes(dayOfWeek) : true;
  const isBeforeShift = shiftStartMinutes !== null && currentMinutes < shiftStartMinutes;
  // Punch In allowed from 1 hour before shift start. Overtime: outside [shiftStart-60, shiftEnd+buffer].
  const earlyLoginThresholdMinutes = shiftStartMinutes !== null ? shiftStartMinutes - 60 : null;
  const outsideShiftHours =
    shiftStartMinutes !== null &&
    shiftEndMinutes !== null &&
    (currentMinutes < (earlyLoginThresholdMinutes ?? shiftStartMinutes) || currentMinutes > shiftEndMinutes + bufferMinutes);
  const isOvertime = !isWorkingDay || (isWorkingDay && outsideShiftHours);

  // Punch In button disabled until 1 hour before shift (or always if no shift, e.g. overtime day)
  const canPunchIn = !shift || (shiftStartMinutes !== null && currentMinutes >= shiftStartMinutes - 60);
  const firstPunchIsLate =
    log?.check_in_time && shift
      ? toMinutes(log.check_in_time) > shiftStartMinutes! + shift.gracePeriodMinutes
      : false;
  // Only show overtime tag when punch-in was after shift end; early punch-in is on-time
  const firstPunchIsOvertime =
    log?.check_in_time && shiftStartMinutes !== null && shiftEndMinutes !== null
      ? toMinutes(log.check_in_time) > shiftEndMinutes + bufferMinutes
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
    if (confirmDialog === 'overtime') onCheckIn();
    else onCheckOut();
  };

  const buttonDisabled = actionLoading || cooldownSecondsLeft > 0;

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

        {/* Pulsing round clock */}
        <div
          className={`w-28 h-28 mx-auto rounded-full flex flex-col items-center justify-center mb-5 ${
            isCompleted
              ? 'bg-emerald-50 border-4 border-emerald-200'
              : isCheckedIn
                ? 'bg-blue-50 border-4 border-blue-200 animate-pulse'
                : 'bg-gray-50 border-4 border-gray-200'
          }`}
        >
          {isCompleted ? (
            <>
              <CheckCircle2 className="w-7 h-7 text-emerald-500 mb-0.5" />
              <span className="text-xs text-emerald-600 font-medium">اكتمل اليوم</span>
            </>
          ) : isCheckedIn ? (
            <>
              <Clock className="w-7 h-7 text-blue-500 mb-0.5" />
              <span className="text-xs font-mono tabular-nums text-blue-700 font-semibold leading-tight">
                {formatElapsed(displayElapsedSeconds)}
              </span>
              <span className="text-xs text-blue-500">في العمل</span>
            </>
          ) : (
            <>
              <LogIn className="w-7 h-7 text-gray-400 mb-0.5" />
              <span className="text-xs text-gray-500">لم يتم التسجيل</span>
            </>
          )}
        </div>

        {/* Status badge for first punch */}
        {log?.check_in_time && (
          <div className="flex items-center justify-center gap-2 mb-4 text-sm">
            <div className="text-center">
              <p className="text-xs text-gray-400">الحضور</p>
              <div className="flex items-center gap-1.5">
                <p className="text-gray-800 font-medium">{formatTime(log.check_in_time)}</p>
                {firstPunchIsLate ? (
                  <span className="px-1.5 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700 border border-amber-200">متأخر</span>
                ) : firstPunchIsOvertime ? (
                  <span className="px-1.5 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 border border-blue-200">عمل إضافي</span>
                ) : (
                  <span className="px-1.5 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">في الوقت</span>
                )}
              </div>
            </div>
            {log.check_out_time && (
              <div className="text-center mr-4">
                <p className="text-xs text-gray-400">الانصراف</p>
                <p className="text-gray-800 font-medium">{formatTime(log.check_out_time)}</p>
              </div>
            )}
          </div>
        )}

        {/* Progress bar: workday completion only (time-based, 100% at shift end). Hidden during pure overtime work. */}
        {isCheckedIn && !isOvertime && shiftDuration != null && shiftDuration > 0 && (
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

        {/* Hours worked: actual time since punch-in (late arrival shows here) */}
        {isCheckedIn && (
          <div className="text-center mb-4">
            <span className="text-sm text-gray-600">
              ساعات العمل: <span className="font-semibold text-gray-800">{formatElapsed(punchInElapsedSeconds)}</span>
            </span>
          </div>
        )}

        {/* Total worked — single line for completed day */}
        {isCompleted && workedMinutes > 0 && (
          <div className="text-center mb-4">
            <span className="text-sm text-gray-600">
              إجمالي ساعات العمل: <span className="font-semibold text-gray-800">{Math.floor(workedMinutes / 60)}س {workedMinutes % 60}د</span>
            </span>
          </div>
        )}

        {/* Contextual notes */}
        {!log?.check_in_time && isBeforeShift && (
          <div className="flex items-center gap-1.5 justify-center mb-3 text-xs text-gray-400">
            <Clock className="w-3.5 h-3.5" />
            <span>لم يبدأ دوامك بعد</span>
          </div>
        )}
        {!log?.check_in_time && isOvertime && (
          <div className="flex items-center gap-1.5 justify-center mb-3 text-xs text-amber-500">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>سيتم احتساب هذا كعمل إضافي</span>
          </div>
        )}
        {isCompleted && firstPunchIsOvertime && (
          <div className="flex items-center gap-1.5 justify-center mb-3 text-xs text-amber-500">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>سيتم احتساب هذا كعمل إضافي</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-2">
          {!log?.check_in_time && (
            <button
              onClick={handleCheckInClick}
              disabled={buttonDisabled || !canPunchIn}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-colors"
            >
              <LogIn className="w-5 h-5" />
              {actionLoading ? 'جاري التسجيل...' : cooldownSecondsLeft > 0 ? `انتظر ${cooldownSecondsLeft}ث` : !canPunchIn ? 'يمكنك التسجيل قبل ساعة من بدء الدوام' : 'تسجيل الحضور'}
            </button>
          )}
          {isCheckedIn && (
            <button
              onClick={() => onCheckOut()}
              disabled={actionLoading}
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-colors"
            >
              <LogOut className="w-5 h-5" />
              {actionLoading ? 'جاري التسجيل...' : 'تسجيل الانصراف'}
            </button>
          )}
          {isCompleted && (
            <button
              onClick={() => setConfirmDialog('overtime')}
              disabled={buttonDisabled}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-colors"
            >
              <LogIn className="w-5 h-5" />
              {actionLoading ? 'جاري التسجيل...' : cooldownSecondsLeft > 0 ? `انتظر ${cooldownSecondsLeft}ث` : 'تسجيل الحضور (عمل إضافي)'}
            </button>
          )}
        </div>

        {/* Location note removed: location tracking disabled */}
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl text-center">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            </div>
            <h3 className="text-gray-800 font-semibold mb-2">تأكيد</h3>
            <p className="text-sm text-gray-500 mb-5">
              {confirmDialog === 'overtime'
                ? 'أنت خارج ساعات الدوام. سيتم تسجيل هذا كعمل إضافي. هل تريد المتابعة؟'
                : 'أنت تغادر قبل نهاية الدوام بأكثر من ساعة. هل تريد المتابعة؟'}
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
