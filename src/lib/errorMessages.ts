/**
 * Map Supabase/Postgres and generic errors to user-friendly Arabic messages
 * for department (and other) operations.
 */
function getErrorCode(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'code' in err && typeof (err as { code: string }).code === 'string') {
    return (err as { code: string }).code;
  }
  return undefined;
}

function getErrorMessage(err: unknown): string | undefined {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: string }).message === 'string') {
    return (err as { message: string }).message;
  }
  return undefined;
}

/** Arabic messages for known error cases (department and general). */
const MESSAGES: Record<string, string> = {
  '23505': 'اسم القسم (عربي أو إنجليزي) مستخدم مسبقاً في هذه المؤسسة',
  '23503': 'البيانات المرتبطة تمنع تنفيذ العملية',
  '42501': 'ليس لديك صلاحية تنفيذ هذه العملية',
  'PGRST301': 'انتهت الجلسة أو لا تملك الصلاحية',
};

/** Returns a user-friendly Arabic message for department-related errors, or a generic fallback. */
export function getDepartmentErrorMessage(err: unknown, fallback: string): string {
  const code = getErrorCode(err);
  if (code && MESSAGES[code]) return MESSAGES[code];
  const msg = getErrorMessage(err);
  if (msg && /unique|duplicate|already exists/i.test(msg)) return MESSAGES['23505'];
  if (msg && /permission|denied|policy|RLS/i.test(msg)) return MESSAGES['42501'];
  if (msg && /foreign key|violates/i.test(msg)) return MESSAGES['23503'];
  return fallback;
}
