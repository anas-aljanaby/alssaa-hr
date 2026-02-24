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
  MANAGER_ROLE_REQUIRED: 'يجب أن يكون مدير القسم من المستخدمين بدور مدير قسم',
};

/** Returns a user-friendly Arabic message for department-related errors, or a generic fallback. */
export function getDepartmentErrorMessage(err: unknown, fallback: string): string {
  const code = getErrorCode(err);
  if (code && MESSAGES[code]) return MESSAGES[code];
  const msg = getErrorMessage(err);
  if (msg === 'MANAGER_ROLE_REQUIRED') return MESSAGES.MANAGER_ROLE_REQUIRED;
  if (msg && /unique|duplicate|already exists/i.test(msg)) return MESSAGES['23505'];
  if (msg && /permission|denied|policy|RLS/i.test(msg)) return MESSAGES['42501'];
  if (msg && /foreign key|violates/i.test(msg)) return MESSAGES['23503'];
  return fallback;
}

/** Error codes returned by the invite-user Edge Function. */
const ADD_USER_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'غير مصرح',
  PGRST301: 'انتهت الجلسة أو لا تملك الصلاحية',
  NO_PROFILE: 'لم يتم العثور على الملف الشخصي',
  '42501': 'ليس لديك صلاحية تنفيذ هذه العملية',
  INVALID_EMAIL: 'البريد الإلكتروني غير صالح',
  INVALID_NAME: 'الاسم يجب أن يكون حرفين على الأقل',
  INVALID_ROLE: 'الدور مطلوب',
  INVALID_DEPARTMENT: 'القسم مطلوب',
  DUPLICATE_EMAIL: 'البريد الإلكتروني مسجل مسبقاً',
  CREATE_USER_FAILED: 'فشل إنشاء المستخدم',
  INTERNAL: 'خطأ في الخادم',
};

/**
 * Returns a user-friendly Arabic message for Add User (invite-user) errors.
 * Response shape: { error?: string, code?: string } or FunctionError from supabase.functions.invoke.
 */
export function getAddUserErrorMessage(
  err: unknown,
  response?: { error?: string; code?: string } | null,
  fallback = 'فشل إضافة المستخدم'
): string {
  if (response?.error && typeof response.error === 'string') {
    const code = response.code && ADD_USER_MESSAGES[response.code] ? response.code : undefined;
    if (code) return ADD_USER_MESSAGES[code];
    return response.error;
  }
  const code = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : undefined;
  if (typeof code === 'string' && ADD_USER_MESSAGES[code]) return ADD_USER_MESSAGES[code];
  const msg = getErrorMessage(err);
  if (msg && /already been registered|duplicate|already exists/i.test(msg)) return ADD_USER_MESSAGES.DUPLICATE_EMAIL;
  if (msg && /permission|denied|RLS/i.test(msg)) return ADD_USER_MESSAGES['42501'];
  return fallback;
}

/** Arabic messages for profile update / deactivate errors (RLS, FK, etc.). */
const PROFILE_UPDATE_MESSAGES: Record<string, string> = {
  '23503': 'البيانات المرتبطة تمنع تنفيذ العملية',
  '42501': 'ليس لديك صلاحية تنفيذ هذه العملية',
  PGRST301: 'انتهت الجلسة أو لا تملك الصلاحية',
};

/**
 * Returns a user-friendly Arabic message for profile update or deactivate errors.
 */
export function getProfileUpdateErrorMessage(err: unknown, fallback = 'فشل تحديث المستخدم'): string {
  const code = getErrorCode(err);
  if (code && PROFILE_UPDATE_MESSAGES[code]) return PROFILE_UPDATE_MESSAGES[code];
  const msg = getErrorMessage(err);
  if (msg && /permission|denied|policy|RLS/i.test(msg)) return PROFILE_UPDATE_MESSAGES['42501'];
  if (msg && /foreign key|violates/i.test(msg)) return PROFILE_UPDATE_MESSAGES['23503'];
  return fallback;
}
