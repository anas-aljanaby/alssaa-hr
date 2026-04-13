import type { MonthDaySummary } from '@/lib/services/attendance.service';
import type { CSSProperties } from 'react';

const STATUS_COLORS = {
  present: '#0D9488',
  late: '#D97706',
  absent: '#E11D48',
  on_leave: '#2563EB',
  overtime: '#475569',
} as const;

type AttendanceStatusKey =
  | 'present'
  | 'late'
  | 'absent'
  | 'on_leave'
  | 'overtime';

type SessionStatusKey = 'present' | 'late' | 'overtime';

type StatusColor = (typeof STATUS_COLORS)[keyof typeof STATUS_COLORS];

interface AttendanceStatusTheme {
  label: string;
  color: StatusColor;
  dotStyle: CSSProperties;
  badgeSoftStyle: CSSProperties;
  badgeSolidStyle: CSSProperties;
  accentStyle: CSSProperties;
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

function makeTheme(label: string, color: StatusColor): AttendanceStatusTheme {
  return {
    label,
    color,
    dotStyle: { backgroundColor: color },
    badgeSoftStyle: {
      backgroundColor: hexToRgba(color, 0.1),
      color,
      borderColor: hexToRgba(color, 0.2),
    },
    badgeSolidStyle: {
      backgroundColor: color,
      color: '#FFFFFF',
    },
    accentStyle: {
      borderRightColor: hexToRgba(color, 0.7),
    },
  };
}

export const ATTENDANCE_STATUS_THEME: Record<AttendanceStatusKey, AttendanceStatusTheme> = {
  present: makeTheme('حاضر', STATUS_COLORS.present),
  late: makeTheme('متأخر', STATUS_COLORS.late),
  absent: makeTheme('غائب', STATUS_COLORS.absent),
  on_leave: makeTheme('إجازة', STATUS_COLORS.on_leave),
  overtime: makeTheme('عمل إضافي', STATUS_COLORS.overtime),
};

export const CALENDAR_LEGEND_STATUSES: Array<Exclude<AttendanceStatusKey, 'overtime'>> = [
  'present',
  'late',
  'absent',
  'on_leave',
];

const SESSION_STATUS_TO_ATTENDANCE_STATUS: Record<SessionStatusKey, AttendanceStatusKey> = {
  present: 'present',
  late: 'late',
  overtime: 'overtime',
};

export function getStatusTheme(status: AttendanceStatusKey): AttendanceStatusTheme {
  return ATTENDANCE_STATUS_THEME[status];
}

export function getCalendarDotClass(
  status: MonthDaySummary['status'],
): CSSProperties | null {
  if (!status || status === 'future' || status === 'weekend') return null;
  return ATTENDANCE_STATUS_THEME[status]?.dotStyle ?? null;
}

export function getSessionTheme(
  sessionType: SessionStatusKey,
): AttendanceStatusTheme {
  return ATTENDANCE_STATUS_THEME[SESSION_STATUS_TO_ATTENDANCE_STATUS[sessionType]];
}
