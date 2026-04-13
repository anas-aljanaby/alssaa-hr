/**
 * Module purpose:
 * Bridges shared attendance statuses into the visual theme helpers used by a
 * few legacy surfaces while keeping overtime as a separate modifier.
 */

import type { CSSProperties } from 'react';
import { getStatusConfig, type StatusDisplayConfig } from './statusConfig';
import type { DisplayStatus } from './types';

export type HistoricalAttendanceStatus = 'present' | 'late' | 'absent' | 'on_leave';
export type CalendarStatusLike =
  | HistoricalAttendanceStatus
  | 'weekend'
  | 'future'
  | null;
export type SessionStatusLike = 'present' | 'late';
export type VisualStatus = DisplayStatus;

export interface StatusVisualTheme {
  label: string;
  color: string;
  hexColor: string;
  dotStyle: CSSProperties;
  badgeSoftStyle: CSSProperties;
  badgeSolidStyle: CSSProperties;
  accentStyle: CSSProperties;
  tone: StatusDisplayConfig['tone'];
}

const OVERTIME_VISUAL_THEME: StatusVisualTheme = {
  label: 'عمل إضافي',
  color: '#475569',
  hexColor: '#475569',
  dotStyle: { backgroundColor: '#475569' },
  badgeSoftStyle: {
    backgroundColor: 'rgba(71, 85, 105, 0.10)',
    color: '#475569',
    borderColor: 'rgba(71, 85, 105, 0.20)',
  },
  badgeSolidStyle: {
    backgroundColor: '#475569',
    color: '#FFFFFF',
  },
  accentStyle: {
    borderRightColor: 'rgba(71, 85, 105, 0.70)',
  },
  tone: 'gray',
};

function toVisualTheme(config: StatusDisplayConfig): StatusVisualTheme {
  return {
    label: config.label,
    color: config.hexColor,
    hexColor: config.hexColor,
    dotStyle: { backgroundColor: config.hexColor },
    badgeSoftStyle: {
      backgroundColor: `${config.hexColor}1A`,
      color: config.hexColor,
      borderColor: `${config.hexColor}33`,
    },
    badgeSolidStyle: {
      backgroundColor: config.hexColor,
      color: '#FFFFFF',
    },
    accentStyle: {
      borderRightColor: `${config.hexColor}B3`,
    },
    tone: config.tone,
  };
}

export function getDisplayStatusForHistoricalStatus(
  status: HistoricalAttendanceStatus
): DisplayStatus {
  switch (status) {
    case 'present':
      return 'present';
    case 'late':
      return 'late';
    case 'on_leave':
      return 'on_leave_day';
    case 'absent':
    default:
      return 'absent_day';
  }
}

export function getDisplayStatusForCalendarStatus(
  status: CalendarStatusLike
): DisplayStatus | null {
  switch (status) {
    case 'present':
      return 'present';
    case 'late':
      return 'late';
    case 'absent':
      return 'absent_day';
    case 'on_leave':
      return 'on_leave_day';
    case 'weekend':
      return 'weekend';
    case 'future':
    case null:
    default:
      return null;
  }
}

export function isOvertimeCalendarStatus(hasOvertime: boolean): boolean {
  return hasOvertime;
}

export function getVisualTheme(
  status: VisualStatus,
  hasOvertime = false
): StatusVisualTheme {
  if (hasOvertime) {
    return OVERTIME_VISUAL_THEME;
  }

  return toVisualTheme(getStatusConfig(status));
}

export function getCalendarVisualTheme(
  status: CalendarStatusLike,
  hasOvertime = false
): StatusVisualTheme | null {
  if (hasOvertime) {
    return OVERTIME_VISUAL_THEME;
  }

  const displayStatus = getDisplayStatusForCalendarStatus(status);
  return displayStatus ? getVisualTheme(displayStatus) : null;
}

export function getSessionVisualTheme(session: {
  is_overtime?: boolean | null;
  status?: SessionStatusLike | null;
}): StatusVisualTheme {
  if (session.is_overtime) {
    return OVERTIME_VISUAL_THEME;
  }

  return getVisualTheme(session.status === 'late' ? 'late' : 'present');
}

export const CALENDAR_LEGEND_VISUALS: VisualStatus[] = [
  'present',
  'late',
  'absent_day',
  'on_leave_day',
];
