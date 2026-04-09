/**
 * Module purpose:
 * Centralizes the visual display metadata for every attendance display status,
 * including Arabic labels and Tailwind color tokens used by shared UI pieces.
 */

import { isDisplayStatus, type DisplayStatus } from './types';

export interface StatusDisplayConfig {
  label: string;
  labelEn: string;
  color: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
  icon?: string;
}

const NEUTRAL_STATUS_CONFIG: StatusDisplayConfig = {
  label: 'غير معروف',
  labelEn: 'Unknown',
  color: 'text-gray-600',
  bgColor: 'bg-gray-50',
  borderColor: 'border-gray-300',
  dotColor: 'bg-gray-400',
};

export const STATUS_DISPLAY: Record<DisplayStatus, StatusDisplayConfig> = {
  present_now: {
    label: 'موجود الآن',
    labelEn: 'Present now',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-500',
    dotColor: 'bg-green-500',
  },
  late_now: {
    label: 'متأخر',
    labelEn: 'Late now',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-500',
    dotColor: 'bg-amber-500',
  },
  finished: {
    label: 'أنهى الدوام',
    labelEn: 'Finished shift',
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-400',
    dotColor: 'bg-slate-400',
  },
  absent: {
    label: 'غائب',
    labelEn: 'Absent',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-500',
    dotColor: 'bg-red-500',
  },
  on_leave: {
    label: 'في إجازة',
    labelEn: 'On leave',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-500',
    dotColor: 'bg-purple-500',
  },
  not_registered: {
    label: 'لم يسجل بعد',
    labelEn: 'Not registered yet',
    color: 'text-gray-500',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-300',
    dotColor: 'bg-gray-300',
  },
  present: {
    label: 'حاضر',
    labelEn: 'Present',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-500',
    dotColor: 'bg-green-500',
  },
  late: {
    label: 'متأخر',
    labelEn: 'Late',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-500',
    dotColor: 'bg-amber-500',
  },
  absent_day: {
    label: 'غائب',
    labelEn: 'Absent day',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-500',
    dotColor: 'bg-red-500',
  },
  on_leave_day: {
    label: 'في إجازة',
    labelEn: 'On leave day',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-500',
    dotColor: 'bg-purple-500',
  },
  weekend: {
    label: 'عطلة أسبوعية',
    labelEn: 'Weekend',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
    dotColor: 'bg-blue-300',
  },
  holiday: {
    label: 'عطلة رسمية',
    labelEn: 'Holiday',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-400',
    dotColor: 'bg-blue-400',
  },
};

export function getStatusConfig(status: DisplayStatus): StatusDisplayConfig;
export function getStatusConfig(status: string): StatusDisplayConfig;
export function getStatusConfig(status: DisplayStatus | string): StatusDisplayConfig {
  if (isDisplayStatus(status)) {
    return STATUS_DISPLAY[status];
  }

  return NEUTRAL_STATUS_CONFIG;
}
