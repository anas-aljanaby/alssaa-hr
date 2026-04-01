import { LogIn, LogOut, Clock, CalendarDays } from 'lucide-react';
import type { AttendanceSession } from '@/lib/services/attendance.service';
import { getSessionTheme, getStatusTheme } from './attendanceStatusTheme';

export type AttendanceListItem =
  | { kind: 'session'; session: AttendanceSession }
  | { kind: 'absent_day'; date: string };

interface Props {
  items: AttendanceListItem[];
  selectedDate: string | null;
  onClearFilter?: () => void;
  title?: string;
}

function formatWallTime(t: string | null): string {
  if (!t) return '--:--';
  return t.includes('T') ? t.slice(11, 16) : t.slice(0, 5);
}

function formatDayAndMonth(date: string) {
  const d = new Date(`${date}T00:00:00`);
  const day = new Intl.DateTimeFormat('en-US', { day: '2-digit', numberingSystem: 'latn' }).format(d);
  const AR_GREGORIAN_MONTHS = [
    'يناير',
    'فبراير',
    'مارس',
    'ابريل',
    'مايو',
    'يونيو',
    'يوليو',
    'اغسطس',
    'سبتمبر',
    'اكتوبر',
    'نوفمبر',
    'ديسمبر',
  ];
  const month = AR_GREGORIAN_MONTHS[d.getMonth()] ?? '';
  return { day, month };
}

function formatWeekday(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('ar-IQ', {
    weekday: 'long',
  });
}

function sessionType(session: AttendanceSession): 'present' | 'late' | 'overtime' {
  if (session.is_overtime) return 'overtime';
  if (session.status === 'late') return 'late';
  return 'present';
}

export function TodayPunchLog({ items, selectedDate, onClearFilter, title = 'سجل الجلسات' }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-blue-900">{title}</h2>
        {selectedDate && onClearFilter && (
          <button
            type="button"
            onClick={onClearFilter}
            className="px-2.5 py-1 text-xs rounded-full border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
          >
            عرض كل الجلسات
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-gray-400">
          <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">
            {selectedDate ? 'لا توجد جلسات في هذا اليوم' : 'لا توجد سجلات لهذا الشهر'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            item.kind === 'session'
              ? <SessionRow key={item.session.id} session={item.session} />
              : <AbsentDayRow key={`absent-${item.date}`} date={item.date} />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionRow({ session }: { session: AttendanceSession }) {
  const openSession = !session.check_out_time;
  const type = sessionType(session);
  const statusTheme = getSessionTheme(type);
  const typeBadgeLabel = statusTheme.label;

  const dateParts = formatDayAndMonth(session.date);

  return (
    <div
      className="relative bg-white rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.08)] p-4 pt-8 border-r-4"
      style={statusTheme.accentStyle}
    >
      <span
        className="absolute top-3 left-4 inline-flex items-center px-[12px] py-[2px] rounded-[20px] text-[12px] font-medium font-['IBM_Plex_Sans_Arabic',_sans-serif]"
        style={statusTheme.badgeSolidStyle}
      >
        {typeBadgeLabel}
      </span>
      <div className="flex items-center gap-5">
        <div className="min-w-[78px] text-center">
          <p className="text-[12px] font-normal text-[#94A3B8] font-['IBM_Plex_Sans_Arabic',_sans-serif]">{formatWeekday(session.date)}</p>
          <div className="flex items-baseline justify-center gap-1 mt-1 text-blue-900 font-['IBM_Plex_Sans_Arabic',_sans-serif]">
            <span className="text-[20px] font-bold leading-none">{dateParts.day}</span>
            <span className="text-[13px] font-bold leading-none">{dateParts.month}</span>
          </div>
        </div>

        <div className="h-12 w-px bg-gray-200" />

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-3 text-gray-800">
            <LogIn className="w-4 h-4 text-teal-700" />
            <span className="text-[15px] font-medium text-[#334155] font-['IBM_Plex_Mono',_monospace] tabular-nums">{formatWallTime(session.check_in_time)}</span>
          </div>

          <div className="flex items-center gap-3 text-gray-800">
            <LogOut className="w-4 h-4 text-gray-500" />
            <span className={`text-[15px] font-medium font-['IBM_Plex_Mono',_monospace] tabular-nums ${openSession ? 'text-gray-300' : 'text-[#334155]'}`}>
              {formatWallTime(session.check_out_time)}
            </span>
            {openSession ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] bg-indigo-100 text-indigo-700">
                مباشر
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {session.is_auto_punch_out && (
        <div className="mt-3 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1 inline-flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          انصراف تلقائي
        </div>
      )}
    </div>
  );
}

function AbsentDayRow({ date }: { date: string }) {
  const statusTheme = getStatusTheme('absent');
  const dateParts = formatDayAndMonth(date);
  return (
    <div
      className="relative bg-white rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.08)] p-4 pt-8 border-r-4"
      style={statusTheme.accentStyle}
    >
      <span
        className="absolute top-3 left-4 inline-flex items-center px-[12px] py-[2px] rounded-[20px] text-[12px] font-medium font-['IBM_Plex_Sans_Arabic',_sans-serif]"
        style={statusTheme.badgeSolidStyle}
      >
        {statusTheme.label}
      </span>
      <div className="flex items-center gap-5">
        <div className="min-w-[78px] text-center">
          <p className="text-[12px] font-normal text-[#94A3B8] font-['IBM_Plex_Sans_Arabic',_sans-serif]">{formatWeekday(date)}</p>
          <div className="flex items-baseline justify-center gap-1 mt-1 text-blue-900 font-['IBM_Plex_Sans_Arabic',_sans-serif]">
            <span className="text-[20px] font-bold leading-none">{dateParts.day}</span>
            <span className="text-[13px] font-bold leading-none">{dateParts.month}</span>
          </div>
        </div>
        <div className="h-12 w-px bg-gray-200" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-700">لم يتم تسجيل حضور أو انصراف في يوم عمل</p>
        </div>
      </div>
    </div>
  );
}
