/**
 * Module purpose:
 * Defines the team-attendance-specific state model used by the team board.
 * These states are derived from canonical attendance summary/session facts and
 * intentionally separate operational live states from historical date states.
 */

export const TEAM_ATTENDANCE_LIVE_STATES = [
  'available_now',
  'late',
  'on_break',
  'not_entered_yet',
  'absent',
  'on_leave',
  'incomplete_shift',
  'fulfilled_shift',
  'neutral',
] as const;

export type TeamAttendanceLiveState = (typeof TEAM_ATTENDANCE_LIVE_STATES)[number];

export const TEAM_ATTENDANCE_DATE_STATES = [
  'fulfilled_shift',
  'incomplete_shift',
  'late',
  'absent',
  'on_leave',
  'neutral',
] as const;

export type TeamAttendanceDateState = (typeof TEAM_ATTENDANCE_DATE_STATES)[number];

export const TEAM_ATTENDANCE_PRIMARY_STATES = [
  'available_now',
  'fulfilled_shift',
  'incomplete_shift',
  'late',
  'on_break',
  'not_entered_yet',
  'absent',
  'on_leave',
  'neutral',
] as const;

export type TeamAttendancePrimaryState = (typeof TEAM_ATTENDANCE_PRIMARY_STATES)[number];

export type TeamAttendanceChipKey =
  | 'all'
  | 'available_now'
  | 'fulfilled_shift'
  | 'incomplete_shift'
  | 'late'
  | 'on_break'
  | 'not_entered_yet'
  | 'absent'
  | 'on_leave'
  | 'overtime';

export interface TeamAttendanceStateDefinition {
  label: string;
  labelEn: string;
  chipVisible: boolean;
  liveMeaning?: string;
  dateMeaning?: string;
}

export const TEAM_ATTENDANCE_STATE_DEFINITIONS: Record<
  TeamAttendancePrimaryState,
  TeamAttendanceStateDefinition
> = {
  available_now: {
    label: 'موجود الآن',
    labelEn: 'Available now',
    chipVisible: true,
    liveMeaning: 'Currently checked in, not late, and available to take work now.',
  },
  fulfilled_shift: {
    label: 'أكمل الدوام',
    labelEn: 'Fulfilled shift',
    chipVisible: true,
    liveMeaning: 'Checked out after already satisfying shift minimums; shown on rows only in live mode.',
    dateMeaning: 'Scheduled shift was satisfied, not late, and overtime does not affect the result.',
  },
  incomplete_shift: {
    label: 'دوام غير مكتمل',
    labelEn: 'Incomplete shift',
    chipVisible: true,
    dateMeaning: 'Worked a regular shift session but did not satisfy minimum required minutes.',
  },
  late: {
    label: 'متأخر',
    labelEn: 'Late',
    chipVisible: true,
    liveMeaning: 'Currently checked in and late.',
    dateMeaning: 'Worked the day late and does not overlap with fulfilled shift.',
  },
  on_break: {
    label: 'في استراحة',
    labelEn: 'On break',
    chipVisible: true,
    liveMeaning: 'Arrived on time, has sessions today, is currently checked out, and the shift window is still open.',
  },
  not_entered_yet: {
    label: 'لم يسجل بعد',
    labelEn: 'Not entered yet',
    chipVisible: true,
    liveMeaning: 'Working day with no sessions yet, before scheduled shift end.',
  },
  absent: {
    label: 'غائب',
    labelEn: 'Absent',
    chipVisible: true,
    liveMeaning: 'Working day with no sessions at or after scheduled shift end.',
    dateMeaning: 'No qualifying regular shift attendance for the day; overtime may still overlap.',
  },
  on_leave: {
    label: 'في إجازة',
    labelEn: 'On leave',
    chipVisible: true,
    liveMeaning: 'Approved leave for the current day.',
    dateMeaning: 'Approved leave for the selected date.',
  },
  neutral: {
    label: 'خارج التصنيف',
    labelEn: 'Neutral',
    chipVisible: false,
    liveMeaning: 'Used for off-day, holiday, no-shift, or checked-out-under-minimum cases.',
    dateMeaning: 'Used for off-day, holiday, no-shift, or before-join cases.',
  },
};

export function isTeamAttendanceLiveState(value: string): value is TeamAttendanceLiveState {
  return TEAM_ATTENDANCE_LIVE_STATES.includes(value as TeamAttendanceLiveState);
}

export function isTeamAttendanceDateState(value: string): value is TeamAttendanceDateState {
  return TEAM_ATTENDANCE_DATE_STATES.includes(value as TeamAttendanceDateState);
}

export function isTeamAttendancePrimaryState(value: string): value is TeamAttendancePrimaryState {
  return TEAM_ATTENDANCE_PRIMARY_STATES.includes(value as TeamAttendancePrimaryState);
}
