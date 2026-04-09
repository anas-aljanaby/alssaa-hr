/**
 * Module purpose:
 * Converts canonical day status plus optional live session presence into the
 * single UI-facing display status consumed by shared attendance components.
 */

import type { DayStatus, DisplayStatus, LivePresence, ResolveContext } from './types';

/**
 * Resolves the display status for a user in either live or date mode.
 *
 * In live mode (`livePresence !== null`), real-time session presence overlays
 * the backend-resolved day outcome so the UI can distinguish between people
 * currently checked in, already finished, or still not registered.
 *
 * In date mode (`livePresence === null`), the function collapses the canonical
 * day status into the historical UI statuses used by badges, charts, and lists.
 *
 * @example
 * resolveDisplayStatus('on_leave', 'checked_in', { isWithinShiftWindow: true })
 * // => 'on_leave'
 *
 * @example
 * resolveDisplayStatus('late', 'checked_in', { isWithinShiftWindow: true })
 * // => 'late_now'
 *
 * @example
 * resolveDisplayStatus('present', 'checked_out', { isWithinShiftWindow: false })
 * // => 'finished'
 *
 * @example
 * resolveDisplayStatus('absent', 'no_session', { isWithinShiftWindow: true })
 * // => 'absent'
 *
 * @example
 * resolveDisplayStatus('present', 'no_session', { isWithinShiftWindow: true })
 * // => 'not_registered'
 *
 * @example
 * resolveDisplayStatus('present', null, { isWithinShiftWindow: false })
 * // => 'present'
 *
 * @example
 * resolveDisplayStatus('on_leave', null, { isWithinShiftWindow: false })
 * // => 'on_leave_day'
 *
 * @example
 * resolveDisplayStatus('future', null, { isWithinShiftWindow: false })
 * // => 'absent_day'
 */
export function resolveDisplayStatus(
  dayStatus: DayStatus,
  livePresence: LivePresence | null,
  context: ResolveContext
): DisplayStatus {
  if (livePresence !== null) {
    if (dayStatus === 'on_leave') return 'on_leave';
    if (dayStatus === 'weekend') return 'weekend';
    if (dayStatus === 'holiday') return 'holiday';

    switch (livePresence) {
      case 'checked_in':
        return dayStatus === 'late' ? 'late_now' : 'present_now';
      case 'checked_out':
        return 'finished';
      case 'no_session':
        if (dayStatus === 'absent') return 'absent';
        return context.isWithinShiftWindow ? 'not_registered' : 'absent';
    }
  }

  switch (dayStatus) {
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
    case 'holiday':
      return 'holiday';
    case 'future':
    case 'not_joined':
      return 'absent_day';
  }
}
