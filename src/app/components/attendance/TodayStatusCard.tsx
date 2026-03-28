import { useEffect, useState } from 'react';
import { LogIn, LogOut, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  isOvertimeTime,
  shouldShowShiftCongrats,
  totalWorkedMinutesToday,
  wallTimeHHMM,
  wallTimeToMinutes,
  type TodayRecord,
} from '@/lib/services/attendance.service';
import { now } from '@/lib/time';

interface Props {
  today: TodayRecord;
  actionLoading: boolean;
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
  return wallTimeHHMM(t) ?? '--:--';
}

function todayArabicDate(): string {
  return now().toLocaleDateString('ar-IQ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function TodayStatusCard({ today, actionLoading, onCheckIn, onCheckOut }: Props) {
  const { log, shift } = today;

  const [punchInElapsedSeconds, setPunchInElapsedSeconds] = useState(0);
  const [workdayElapsedSeconds, setWorkdayElapsedSeconds] = useState(0);
  const [confirmDialog, setConfirmDialog] = useState<'overtime' | null>(null);

  const isCheckedIn = !!(log?.check_in_time && !log?.check_out_time);

  // Real elapsed since punch-in (for the main clock and "hours worked")
  useEffect(() => {
    if (!isCheckedIn || !log?.check_in_time) {
      setPunchInElapsedSeconds(0);
      return;
    }
    const computePunchInElapsed = () => {
      const hm = wallTimeHHMM(log.check_in_time!);
      if (!hm) return 0;
      const [h, m] = hm.split(':').map(Number);
      const currentDate = now();
      const inMs = new Date(currentDate).setHours(h, m, 0, 0);
      return Math.max(0, Math.floor((currentDate.getTime() - inMs) / 1000));
    };
    setPunchInElapsedSeconds(computePunchInElapsed());
    const id = setInterval(() => setPunchInElapsedSeconds(computePunchInElapsed()), 1000);
    return () => clearInterval(id);
  }, [isCheckedIn, log?.check_in_time]);

  // Workday elapsed: for progress bar only, caps at shift duration
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

  // Tick every second so current time stays in sync with dev or real clock
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!shift) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [shift]);

  const currentNow = now();
  const currentMinutes = currentNow.getHours() * 60 + currentNow.getMinutes();
  const dayOfWeek = currentNow.getDay();

  const shiftStartMinutes = shift ? toMinutes(shift.workStartTime) : null;
  const shiftEndMinutes = shift ? toMinutes(shift.workEndTime) : null;
  const shiftDuration = shiftStartMinutes !== null && shiftEndMinutes !== null
    ? shiftEndMinutes - shiftStartMinutes
    : null;

  const isOvertime = shift ? isOvertimeTime(currentMinutes, shift, dayOfWeek) : false;
  const isWorkingDay = shift ? !(shift.weeklyOffDays ?? [5, 6]).includes(dayOfWeek) : true;
  const isBeforeShift = shiftStartMinutes !== null && currentMinutes < shiftStartMinutes;
  const showShiftCongrats = shouldShowShiftCongrats(today, currentNow);
  const totalWorkedMin = totalWorkedMinutesToday(today);

  // Progress bar: 0-100%, caps at shift end
  const progressPercent = shiftDuration != null && shiftDuration > 0
    ? Math.min(100, (workdayElapsedSeconds / (shiftDuration * 60)) * 100)
    : 0;

  // Overtime elapsed: time past shift end (only meaningful when checked in past shift end on a working day)
  const isPastShiftEnd = isCheckedIn && shiftEndMinutes !== null && currentMinutes > shiftEndMinutes;
  const overtimeElapsedSeconds = isPastShiftEnd
    ? Math.max(0, (currentMinutes - shiftEndMinutes!) * 60 + currentNow.getSeconds())
    : 0;

  const hoursWorkedSeconds = isCheckedIn ? punchInElapsedSeconds : 0;

  // Overtime: always allowed to punch in. Regular: allowed from 1h before shift.
  const canPunchIn = !shift || isOvertime || (shiftStartMinutes !== null && currentMinutes >= shiftStartMinutes - 60);

  // Badge logic for first punch: check overtime first (matches service logic), then late
  const firstPunchIsOvertime =
    log?.check_in_time && shift
      ? isOvertimeTime(wallTimeToMinutes(log.check_in_time), shift, dayOfWeek)
      : false;
  const firstPunchIsLate =
    log?.check_in_time && shift && !firstPunchIsOvertime
      ? wallTimeToMinutes(log.check_in_time) > shiftStartMinutes! + shift.gracePeriodMinutes
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

  const buttonDisabled = actionLoading;

  // Visual state for the clock circle
  const clockIsOvertime =
    isCheckedIn &&
    (isPastShiftEnd ||
      !isWorkingDay ||
      (shift ? isOvertimeTime(wallTimeToMinutes(log!.check_in_time!), shift, dayOfWeek) : false));

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

        {/* Round clock: blue during regular hours, amber during overtime */}
        <div
          className={`w-28 h-28 mx-auto rounded-full flex flex-col items-center justify-center mb-5 ${
            !isCheckedIn && showShiftCongrats
              ? 'bg-emerald-50 border-4 border-emerald-200'
              : isCheckedIn && clockIsOvertime
                ? 'bg-amber-50 border-4 border-amber-300 animate-pulse'
                : isCheckedIn
                  ? 'bg-blue-50 border-4 border-blue-200 animate-pulse'
                  : 'bg-gray-50 border-4 border-gray-200'
          }`}
        >
          {!isCheckedIn && showShiftCongrats ? (
            <>
              <CheckCircle2 className="w-7 h-7 text-emerald-500 mb-0.5" />
              <span className="text-xs text-emerald-600 font-medium text-center leading-tight px-1">
                أحسنت
              </span>
              <span className="text-[10px] text-emerald-600/90 text-center leading-tight px-1 mt-0.5">
                استوفيت متطلبات الدوام
              </span>
            </>
          ) : isCheckedIn ? (
            <>
              <Clock className={`w-7 h-7 mb-0.5 ${clockIsOvertime ? 'text-amber-500' : 'text-blue-500'}`} />
              <span className={`text-xs font-mono tabular-nums font-semibold leading-tight ${clockIsOvertime ? 'text-amber-700' : 'text-blue-700'}`}>
                {formatElapsed(punchInElapsedSeconds)}
              </span>
              <span className={`text-xs ${clockIsOvertime ? 'text-amber-500' : 'text-blue-500'}`}>
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
        {log?.check_in_time && (
          <div className="flex items-center justify-center gap-2 mb-4 text-sm">
            <div className="text-center">
              <p className="text-xs text-gray-400">الحضور</p>
              <div className="flex items-center gap-1.5">
                <p className="text-gray-800 font-medium">{formatTime(log.check_in_time)}</p>
                {firstPunchIsOvertime ? (
                  <span className="px-1.5 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 border border-blue-200">عمل إضافي</span>
                ) : firstPunchIsLate ? (
                  <span className="px-1.5 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700 border border-amber-200">متأخر</span>
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

        {/* Progress bar: workday completion only, caps at 100%. Hidden during pure overtime. */}
        {isCheckedIn && isWorkingDay && !firstPunchIsOvertime && shiftDuration != null && shiftDuration > 0 && (
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

        {/* Overtime elapsed indicator when working past shift end */}
        {isCheckedIn && isPastShiftEnd && isWorkingDay && !firstPunchIsOvertime && (
          <div className="text-center mb-4">
            <span className="text-sm text-amber-600">
              عمل إضافي: <span className="font-semibold text-amber-700">{formatElapsed(overtimeElapsedSeconds)}</span>
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
          <div className="flex items-center gap-1.5 justify-center mb-3 text-xs text-amber-500">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>سيتم احتساب هذا كعمل إضافي وإنشاء طلب تلقائياً</span>
          </div>
        )}
        {!isCheckedIn && log?.check_in_time && firstPunchIsOvertime && (
          <div className="flex items-center gap-1.5 justify-center mb-3 text-xs text-amber-500">
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
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-colors"
            >
              <LogIn className="w-5 h-5" />
              {actionLoading
                ? 'جاري التسجيل...'
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
              disabled={actionLoading}
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-colors"
            >
              <LogOut className="w-5 h-5" />
              {actionLoading ? 'جاري التسجيل...' : 'تسجيل الانصراف'}
            </button>
          )}
        </div>
      </div>

      {/* Overtime Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl text-center">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
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
