/**
 * Module purpose:
 * Defines the shared attendance status vocabulary used across the app.
 * These types separate canonical day outcomes, live presence overlays,
 * and final UI-facing display states so every surface can resolve status
 * consistently from the same source model.
 */

/**
 * Canonical backend-resolved day status for a single user on a single date.
 */
export const DAY_STATUSES = [
  'present',
  'late',
  'absent',
  'on_leave',
  'weekend',
  'holiday',
  'future',
  'not_joined',
] as const;

export type DayStatus = (typeof DAY_STATUSES)[number];

/**
 * Real-time overlay derived from today's open or closed attendance sessions.
 */
export const LIVE_PRESENCE_VALUES = [
  'checked_in',
  'checked_out',
  'no_session',
] as const;

export type LivePresence = (typeof LIVE_PRESENCE_VALUES)[number];

/**
 * Final UI-facing status rendered by badges, dots, chips, and cards.
 */
export const DISPLAY_STATUSES = [
  'present_now',
  'late_now',
  'finished',
  'absent',
  'on_leave',
  'not_registered',
  'present',
  'late',
  'absent_day',
  'on_leave_day',
  'weekend',
  'holiday',
] as const;

export type DisplayStatus = (typeof DISPLAY_STATUSES)[number];

export const VIEW_MODES = ['live', 'date'] as const;

export type ViewMode = (typeof VIEW_MODES)[number];

export const USER_ROLES = ['admin', 'manager', 'employee'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface ResolveContext {
  isWithinShiftWindow: boolean;
}

export function isDisplayStatus(value: string): value is DisplayStatus {
  return DISPLAY_STATUSES.includes(value as DisplayStatus);
}
