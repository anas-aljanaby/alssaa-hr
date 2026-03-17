import { useMemo, useState } from 'react';
import { Clock3, LogIn, LogOut, CheckCircle2, AlertTriangle } from 'lucide-react';
import { now } from '@/lib/time';
import { isOvertimeTime, type TodayRecord } from '@/lib/services/attendance.service';

interface QuickPunchCardProps {
  today: TodayRecord;
  loading: boolean;
  actionLoading: boolean;
  cooldownSecondsLeft: number;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onOpenAttendance?: () => void;
}

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function formatTime(t?: string | null): string {
  if (!t) return '--:--';
  return t.slice(0, 5);
}

export function QuickPunchCard({
  today,
  loading,
  actionLoading,
  cooldownSecondsLeft,
  onCheckIn,
  onCheckOut,
  onOpenAttendance,
}: QuickPunchCardProps) {
  const { log, shift } = today;
  const [confirmDialog, setConfirmDialog] = useState<'overtime' | null>(null);

  const state = useMemo(() => {
    const currentNow = now();
    const currentMinutes = currentNow.getHours() * 60 + currentNow.getMinutes();
    const dayOfWeek = currentNow.getDay();

    const isCheckedIn = !!(log?.check_in_time && !log?.check_out_time);
    const isCompleted = !!(log?.check_in_time && log?.check_out_time);

    const isOvertimeNow = shift ? isOvertimeTime(currentMinutes, shift, dayOfWeek) : false;
    const shiftStartMinutes = shift ? toMinutes(shift.workStartTime) : null;
    const canPunchIn =
      !shift || isOvertimeNow || (shiftStartMinutes !== null && currentMinutes >= shiftStartMinutes - 60);

    return {
      isCheckedIn,
      isCompleted,
      isOvertimeNow,
      canPunchIn,
    };
  }, [log?.check_in_time, log?.check_out_time, shift]);

  if (loading) {
    return <div className="bg-gray-100 rounded-xl h-40 animate-pulse" />;
  }

  const buttonDisabled = actionLoading || cooldownSecondsLeft > 0;
  const statusText = state.isCompleted
    ? 'اكتمل دوام اليوم'
    : state.isCheckedIn
      ? 'أنت مسجل حضور الآن'
      : 'غير مسجل حضور';

  const handleCheckInClick = () => {
    if (state.isOvertimeNow) {
      setConfirmDialog('overtime');
      return;
    }
    onCheckIn();
  };

  const handleConfirm = () => {
    setConfirmDialog(null);
    onCheckIn();
  };

  return (
    <>
      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-gray-900 text-sm font-semibold">تسجيل الحضور السريع</h3>
            <p className="text-xs text-gray-500 mt-1">{statusText}</p>
          </div>
          {state.isCompleted ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              مكتمل
            </span>
          ) : state.isCheckedIn ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] bg-blue-50 text-blue-700 border border-blue-200">
              <Clock3 className="w-3.5 h-3.5" />
              قيد الدوام
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] bg-gray-50 text-gray-600 border border-gray-200">
              <Clock3 className="w-3.5 h-3.5" />
              غير مسجل
            </span>
          )}
        </div>

        <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-xs text-gray-600">
          <div className="flex items-center justify-between">
            <span>الحضور</span>
            <span className="font-medium text-gray-800">{formatTime(log?.check_in_time)}</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span>الانصراف</span>
            <span className="font-medium text-gray-800">{formatTime(log?.check_out_time)}</span>
          </div>
          {shift && (
            <div className="mt-2 text-[11px] text-gray-500">
              الدوام: {formatTime(shift.workStartTime)} - {formatTime(shift.workEndTime)}
            </div>
          )}
          {!log?.check_in_time && state.isOvertimeNow && (
            <div className="mt-2 text-[11px] text-amber-600 inline-flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              سيتم احتساب الحضور كعمل إضافي
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {!state.isCheckedIn ? (
            <button
              onClick={handleCheckInClick}
              disabled={buttonDisabled || !state.canPunchIn}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors"
            >
              <LogIn className="w-4 h-4" />
              {actionLoading
                ? 'جاري التسجيل...'
                : cooldownSecondsLeft > 0
                  ? `انتظر ${cooldownSecondsLeft}ث`
                  : !state.canPunchIn
                    ? 'قبل الدوام بساعة'
                    : state.isCompleted
                      ? 'حضور إضافي'
                      : 'تسجيل الحضور'}
            </button>
          ) : (
            <button
              onClick={onCheckOut}
              disabled={actionLoading}
              className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors"
            >
              <LogOut className="w-4 h-4" />
              {actionLoading ? 'جاري التسجيل...' : 'تسجيل الانصراف'}
            </button>
          )}

          {onOpenAttendance && (
            <button
              onClick={onOpenAttendance}
              className="px-3 py-2.5 rounded-lg border border-gray-200 text-gray-700 text-sm hover:bg-gray-50 transition-colors"
            >
              التفاصيل
            </button>
          )}
        </div>
      </div>

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
