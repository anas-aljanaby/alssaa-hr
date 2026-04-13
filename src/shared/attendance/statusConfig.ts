/**
 * Module purpose:
 * Centralizes the visual display metadata for every attendance display status,
 * including team-attendance-only derived states, plus the shared color tokens
 * used by cross-surface helpers.
 */

import { isDisplayStatus, type DisplayStatus } from './types';
import {
  isTeamAttendancePrimaryState,
  type TeamAttendancePrimaryState,
} from './teamState';

export type StatusTone =
  | 'emerald'
  | 'green'
  | 'sky'
  | 'amber'
  | 'teal'
  | 'red'
  | 'purple'
  | 'gray'
  | 'slate'
  | 'blue';

export interface StatusDisplayConfig {
  label: string;
  labelEn: string;
  color: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
  hexColor: string;
  tone: StatusTone;
  icon?: string;
}

function makeStatusDisplayConfig(input: StatusDisplayConfig): StatusDisplayConfig {
  return input;
}

const NEUTRAL_STATUS_CONFIG = makeStatusDisplayConfig({
  label: 'غير معروف',
  labelEn: 'Unknown',
  color: 'text-gray-600',
  bgColor: 'bg-gray-50',
  borderColor: 'border-gray-300',
  dotColor: 'bg-gray-400',
  hexColor: '#6B7280',
  tone: 'gray',
});

export const STATUS_DISPLAY: Record<DisplayStatus, StatusDisplayConfig> = {
  present_now: makeStatusDisplayConfig({
    label: 'موجود الآن',
    labelEn: 'Present now',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-500',
    dotColor: 'bg-green-500',
    hexColor: '#16A34A',
    tone: 'green',
  }),
  late_now: makeStatusDisplayConfig({
    label: 'متأخر',
    labelEn: 'Late now',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-500',
    dotColor: 'bg-amber-500',
    hexColor: '#F59E0B',
    tone: 'amber',
  }),
  finished: makeStatusDisplayConfig({
    label: 'أنهى الدوام',
    labelEn: 'Finished shift',
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-400',
    dotColor: 'bg-slate-400',
    hexColor: '#64748B',
    tone: 'slate',
  }),
  absent: makeStatusDisplayConfig({
    label: 'غائب',
    labelEn: 'Absent',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-500',
    dotColor: 'bg-red-500',
    hexColor: '#EF4444',
    tone: 'red',
  }),
  on_leave: makeStatusDisplayConfig({
    label: 'في إجازة',
    labelEn: 'On leave',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-500',
    dotColor: 'bg-purple-500',
    hexColor: '#A855F7',
    tone: 'purple',
  }),
  not_registered: makeStatusDisplayConfig({
    label: 'لم يسجل بعد',
    labelEn: 'Not registered yet',
    color: 'text-gray-500',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-300',
    dotColor: 'bg-gray-300',
    hexColor: '#9CA3AF',
    tone: 'gray',
  }),
  present: makeStatusDisplayConfig({
    label: 'حاضر',
    labelEn: 'Present',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-500',
    dotColor: 'bg-green-500',
    hexColor: '#16A34A',
    tone: 'green',
  }),
  late: makeStatusDisplayConfig({
    label: 'متأخر',
    labelEn: 'Late',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-500',
    dotColor: 'bg-amber-500',
    hexColor: '#F59E0B',
    tone: 'amber',
  }),
  absent_day: makeStatusDisplayConfig({
    label: 'غائب',
    labelEn: 'Absent day',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-500',
    dotColor: 'bg-red-500',
    hexColor: '#EF4444',
    tone: 'red',
  }),
  on_leave_day: makeStatusDisplayConfig({
    label: 'في إجازة',
    labelEn: 'On leave day',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-500',
    dotColor: 'bg-purple-500',
    hexColor: '#A855F7',
    tone: 'purple',
  }),
  weekend: makeStatusDisplayConfig({
    label: 'عطلة أسبوعية',
    labelEn: 'Weekend',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
    dotColor: 'bg-blue-300',
    hexColor: '#60A5FA',
    tone: 'blue',
  }),
  holiday: makeStatusDisplayConfig({
    label: 'عطلة رسمية',
    labelEn: 'Holiday',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-400',
    dotColor: 'bg-blue-400',
    hexColor: '#3B82F6',
    tone: 'blue',
  }),
};

export const TEAM_STATUS_DISPLAY: Record<TeamAttendancePrimaryState, StatusDisplayConfig> = {
  available_now: makeStatusDisplayConfig({
    label: 'موجود الآن',
    labelEn: 'Available now',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-500',
    dotColor: 'bg-emerald-500',
    hexColor: '#10B981',
    tone: 'emerald',
  }),
  fulfilled_shift: makeStatusDisplayConfig({
    label: 'أكمل الدوام',
    labelEn: 'Fulfilled shift',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-600',
    dotColor: 'bg-green-600',
    hexColor: '#16A34A',
    tone: 'green',
  }),
  incomplete_shift: makeStatusDisplayConfig({
    label: 'دوام غير مكتمل',
    labelEn: 'Incomplete shift',
    color: 'text-sky-700',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-500',
    dotColor: 'bg-sky-500',
    hexColor: '#0EA5E9',
    tone: 'sky',
  }),
  late: makeStatusDisplayConfig({
    label: 'متأخر',
    labelEn: 'Late',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-500',
    dotColor: 'bg-amber-500',
    hexColor: '#F59E0B',
    tone: 'amber',
  }),
  on_break: makeStatusDisplayConfig({
    label: 'في استراحة',
    labelEn: 'On break',
    color: 'text-teal-700',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-500',
    dotColor: 'bg-teal-500',
    hexColor: '#14B8A6',
    tone: 'teal',
  }),
  not_entered_yet: makeStatusDisplayConfig({
    label: 'لم يسجل بعد',
    labelEn: 'Not entered yet',
    color: 'text-gray-500',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-300',
    dotColor: 'bg-gray-300',
    hexColor: '#9CA3AF',
    tone: 'gray',
  }),
  absent: makeStatusDisplayConfig({
    label: 'غائب',
    labelEn: 'Absent',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-500',
    dotColor: 'bg-red-500',
    hexColor: '#EF4444',
    tone: 'red',
  }),
  on_leave: makeStatusDisplayConfig({
    label: 'في إجازة',
    labelEn: 'On leave',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-500',
    dotColor: 'bg-purple-500',
    hexColor: '#A855F7',
    tone: 'purple',
  }),
  neutral: makeStatusDisplayConfig({
    label: 'خارج التصنيف',
    labelEn: 'Neutral',
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-300',
    dotColor: 'bg-slate-300',
    hexColor: '#94A3B8',
    tone: 'slate',
  }),
};

export type VisualStatus = DisplayStatus | TeamAttendancePrimaryState;

export function getStatusConfig(status: VisualStatus): StatusDisplayConfig;
export function getStatusConfig(status: string): StatusDisplayConfig;
export function getStatusConfig(status: VisualStatus | string): StatusDisplayConfig {
  if (isDisplayStatus(status)) {
    return STATUS_DISPLAY[status];
  }

  if (isTeamAttendancePrimaryState(status)) {
    return TEAM_STATUS_DISPLAY[status];
  }

  return NEUTRAL_STATUS_CONFIG;
}
