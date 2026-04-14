import { useEffect, useMemo, useState } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/app/components/ui/drawer';
import { Clock, LogIn, LogOut } from 'lucide-react';
import type { DayRecord, PunchEntry } from '@/lib/services/attendance.service';
import { getAttendanceDay, wallTimeToMinutes } from '@/lib/services/attendance.service';
import { getStatusTheme } from './attendanceStatusTheme';

export type DayDetailsSheetTone = 'green' | 'amber' | 'red' | 'blue' | 'gray';

export interface DayDetailsSheetSummary {
  employeeName: string;
  departmentName: string | null;
  statusLabel: string;
  statusTone: DayDetailsSheetTone;
}

interface Props {
  userId: string;
  date: string | null;
  summary?: DayDetailsSheetSummary | null;
  onClose: () => void;
}

function formatDateAr(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('ar-IQ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(t: string | null | undefined): string {
  if (!t) return '—';
  return t.slice(0, 5);
}

function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '—';
  return `${Math.floor(minutes / 60)}س ${minutes % 60}د`;
}

function toneClasses(tone: DayDetailsSheetTone): string {
  const classMap: Record<DayDetailsSheetTone, string> = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-rose-50 text-rose-700 border-rose-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    gray: 'bg-slate-100 text-slate-700 border-slate-200',
  };
  return classMap[tone];
}

function PunchRow({
  punch,
  isLast,
  isAutoPunchOut,
}: {
  punch: PunchEntry;
  isLast: boolean;
  isAutoPunchOut?: boolean;
}) {
  const isIn = punch.type === 'clock_in';

  return (
    <div className="relative flex items-start gap-3">
      {!isLast ? (
        <div className="absolute right-[19px] top-7 bottom-0 w-0.5 bg-gray-100" />
      ) : null}
      <div
        className={`z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          isIn ? 'bg-emerald-100' : 'bg-rose-100'
        }`}
      >
        {isIn ? (
          <LogIn className="h-4 w-4 text-emerald-600" />
        ) : (
          <LogOut className="h-4 w-4 text-rose-500" />
        )}
      </div>

      <div className="flex-1 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-sm font-medium text-gray-800">{formatTime(punch.timestamp)}</span>
            <span className="text-xs text-gray-500">
              {isIn ? 'تسجيل حضور' : 'تسجيل انصراف'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!isIn && isAutoPunchOut ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">
                انصراف تلقائي
              </span>
            ) : null}
            {punch.isOvertime ? (
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">
                إضافي
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-3">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-gray-800">{value}</p>
    </div>
  );
}

function deriveStatusMeta(record: DayRecord | null, summary: DayDetailsSheetSummary | null) {
  if (summary) return summary;

  const hasOvertime =
    record?.summary?.has_overtime === true ||
    (record?.summary?.total_overtime_minutes ?? 0) > 0 ||
    record?.sessions?.some((session) => session.is_overtime) === true;
  const firstSessionStatus = record?.sessions?.find((session) => !session.is_overtime)?.status ?? null;
  const displayStatus =
    record?.summary?.effective_status ??
    (hasOvertime ? 'overtime' : firstSessionStatus);

  if (
    displayStatus &&
    (displayStatus === 'present' ||
      displayStatus === 'late' ||
      displayStatus === 'absent' ||
      displayStatus === 'on_leave' ||
      displayStatus === 'overtime')
  ) {
    const theme = getStatusTheme(displayStatus);
    return {
      employeeName: 'تفاصيل اليوم',
      departmentName: null,
      statusLabel: theme.label,
      statusTone:
        displayStatus === 'present'
          ? 'green'
          : displayStatus === 'late'
            ? 'amber'
            : displayStatus === 'absent'
              ? 'red'
              : displayStatus === 'on_leave'
                ? 'blue'
                : 'gray',
    } satisfies DayDetailsSheetSummary;
  }

  return null;
}

function calculateLateMinutes(record: DayRecord | null): number | null {
  if (!record?.shift || record.summary?.effective_status !== 'late') return null;
  const firstCheckIn =
    record.summary?.first_check_in ??
    [...(record.sessions ?? [])].sort((a, b) => a.check_in_time.localeCompare(b.check_in_time))[0]
      ?.check_in_time ??
    null;
  if (!firstCheckIn) return null;

  const lateMinutes =
    wallTimeToMinutes(firstCheckIn) -
    wallTimeToMinutes(record.shift.workStartTime) -
    record.shift.gracePeriodMinutes;

  return lateMinutes > 0 ? lateMinutes : null;
}

export function DayDetailsSheet({ userId, date, summary = null, onClose }: Props) {
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
  }, [date, userId]);

  const open = !!date;
  const statusMeta = useMemo(() => deriveStatusMeta(record, summary), [record, summary]);
  const sessionMap = new Map((record?.sessions ?? []).map((session) => [session.id, session]));
  const orderedSessions = [...(record?.sessions ?? [])].sort((a, b) =>
    a.check_in_time.localeCompare(b.check_in_time)
  );
  const firstCheckIn = record?.summary?.first_check_in ?? orderedSessions[0]?.check_in_time ?? null;
  const lastCheckOut =
    record?.summary?.last_check_out ??
    [...orderedSessions].reverse().find((session) => !!session.check_out_time)?.check_out_time ??
    null;
  const lateMinutes = useMemo(() => calculateLateMinutes(record), [record]);
  const regularSessions = (record?.sessions ?? []).filter((session) => !session.is_overtime);
  const overtimeSessions = (record?.sessions ?? []).filter((session) => session.is_overtime);
  const regularMinutes = regularSessions.reduce((sum, session) => sum + (session.duration_minutes ?? 0), 0);
  const overtimeMinutes = overtimeSessions.reduce((sum, session) => sum + (session.duration_minutes ?? 0), 0);

  return (
    <Drawer open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }} direction="bottom">
      <DrawerContent className="max-h-[88vh] overflow-y-auto">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-right text-base">تفاصيل اليوم</DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-8">
          {loading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-5 w-1/2 rounded bg-gray-100" />
              <div className="h-4 w-1/3 rounded bg-gray-100" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-16 rounded-2xl bg-gray-100" />
                <div className="h-16 rounded-2xl bg-gray-100" />
              </div>
            </div>
          ) : record ? (
            <>
              <div className="rounded-3xl border border-gray-200 bg-white px-4 py-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-gray-900">
                      {statusMeta?.employeeName ?? summary?.employeeName ?? 'تفاصيل اليوم'}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {summary?.departmentName ? `${summary.departmentName} • ` : ''}
                      {date ? formatDateAr(date) : ''}
                    </p>
                  </div>

                  {statusMeta ? (
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] ${toneClasses(statusMeta.statusTone)}`}>
                      {statusMeta.statusLabel}
                    </span>
                  ) : null}
                </div>

                {record.shift ? (
                  <p className="mt-3 text-xs text-gray-500">
                    الدوام: {formatTime(record.shift.workStartTime)} - {formatTime(record.shift.workEndTime)}
                  </p>
                ) : null}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <MetricCard label="أول دخول" value={formatTime(firstCheckIn)} />
                <MetricCard label="آخر خروج" value={formatTime(lastCheckOut)} />
                <MetricCard label="إجمالي العمل" value={formatMinutes(record.totalMinutesWorked)} />
                <MetricCard label="جلسات عادية" value={regularSessions.length > 0 ? `${regularSessions.length} • ${formatMinutes(regularMinutes)}` : '—'} />
                <MetricCard label="جلسات إضافية" value={overtimeSessions.length > 0 ? `${overtimeSessions.length} • ${formatMinutes(overtimeMinutes)}` : '—'} />
                <MetricCard label="التأخر" value={lateMinutes != null ? `${lateMinutes} د` : '—'} />
              </div>

              <div className="mt-5">
                <h3 className="mb-3 text-sm font-semibold text-gray-700">سجل اليوم</h3>
                {record.punches.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-gray-200 py-8 text-center text-gray-400">
                    <Clock className="mx-auto mb-2 h-8 w-8 opacity-40" />
                    <p className="text-sm">لا توجد حركات حضور لهذا اليوم</p>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-gray-200 bg-white px-4 py-4">
                    {record.punches.map((punch, index) => {
                      const sessionId = punch.id.replace(/-(in|out)$/, '');
                      const session = sessionMap.get(sessionId);

                      return (
                        <PunchRow
                          key={punch.id}
                          punch={punch}
                          isLast={index === record.punches.length - 1}
                          isAutoPunchOut={
                            punch.type === 'clock_out' ? session?.is_auto_punch_out : undefined
                          }
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="py-6 text-center text-gray-400">
              <p className="text-sm">تعذر تحميل بيانات هذا اليوم</p>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
