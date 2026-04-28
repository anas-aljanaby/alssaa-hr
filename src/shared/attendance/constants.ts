/**
 * Default minutes after shift end before auto punch-out runs.
 * Keep in sync with `supabase/functions/auto-punch-out/handler.ts`.
 */
export const DEFAULT_AUTO_PUNCH_OUT_BUFFER_MINUTES = 5;

/**
 * Default minimum overtime segment length to keep.
 * Shorter overtime segments are discarded instead of stored as overtime.
 */
export const DEFAULT_MINIMUM_OVERTIME_MINUTES = 60;
