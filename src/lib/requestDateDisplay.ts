import type { RequestType } from '@/lib/services/requests.service';

const FULL_DAY_REQUEST_TYPES: RequestType[] = ['annual_leave'];

function parseStoredCalendarDate(value: string): Date {
  const [datePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function isFullDayLeaveRequestType(type: RequestType): boolean {
  return FULL_DAY_REQUEST_TYPES.includes(type);
}

export function formatRequestCalendarDate(
  value: string,
  type: RequestType,
  locale = 'ar-IQ'
): string {
  if (isFullDayLeaveRequestType(type)) {
    return parseStoredCalendarDate(value).toLocaleDateString(locale);
  }

  return new Date(value).toLocaleDateString(locale);
}

export function formatRequestDateTime(
  value: string,
  locale = 'ar-IQ',
  options?: Intl.DateTimeFormatOptions
): string {
  return new Date(value).toLocaleString(locale, options);
}

export function formatRequestTime(
  value: string,
  locale = 'ar-IQ',
  options?: Intl.DateTimeFormatOptions
): string {
  return new Date(value).toLocaleTimeString(locale, options);
}
