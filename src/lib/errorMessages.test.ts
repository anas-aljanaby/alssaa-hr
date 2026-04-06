import { describe, it, expect } from 'vitest';
import {
  getDepartmentErrorMessage,
  getAddUserErrorMessage,
  getDeleteUserErrorMessage,
  getProfileUpdateErrorMessage,
  getGeneralManagerTransferErrorMessage,
} from '@/lib/errorMessages';

// ---------------------------------------------------------------------------
// getDepartmentErrorMessage
// ---------------------------------------------------------------------------

describe('getDepartmentErrorMessage', () => {
  const fallback = 'عملية فاشلة';

  it.each([
    ['23505', 'مستخدم مسبقاً'],
    ['23503', 'البيانات المرتبطة'],
    ['42501', 'صلاحية'],
    ['PGRST301', 'انتهت الجلسة'],
    ['MANAGER_ROLE_REQUIRED', 'مدير قسم'],
    ['MANAGER_ALREADY_ASSIGNED_TO_DEPARTMENT', 'لأكثر من قسم واحد'],
    ['MANAGER_MUST_BE_DEPARTMENT_MEMBER', 'أعضاء هذا القسم'],
    ['MANAGER_ROLE_INVALID', 'موظف أو مدير قسم'],
  ])('maps error code %s to expected Arabic message', (code, fragment) => {
    const result = getDepartmentErrorMessage({ code }, fallback);
    expect(result).toContain(fragment);
  });

  it('matches "MANAGER_ROLE_REQUIRED" via message string', () => {
    const result = getDepartmentErrorMessage(new Error('MANAGER_ROLE_REQUIRED'), fallback);
    expect(result).toContain('مدير قسم');
  });

  it('matches manager assignment messages via message string', () => {
    expect(getDepartmentErrorMessage(new Error('MANAGER_ALREADY_ASSIGNED_TO_DEPARTMENT'), fallback)).toContain('لأكثر من قسم واحد');
    expect(getDepartmentErrorMessage(new Error('MANAGER_MUST_BE_DEPARTMENT_MEMBER'), fallback)).toContain('أعضاء هذا القسم');
    expect(getDepartmentErrorMessage(new Error('MANAGER_ROLE_INVALID'), fallback)).toContain('موظف أو مدير قسم');
  });

  it('detects duplicate/unique constraint via message regex', () => {
    const result = getDepartmentErrorMessage(new Error('unique constraint violation'), fallback);
    expect(result).toContain('مستخدم مسبقاً');
  });

  it('detects permission denied via message regex', () => {
    const result = getDepartmentErrorMessage(new Error('permission denied for table'), fallback);
    expect(result).toContain('صلاحية');
  });

  it('detects foreign key violation via message regex', () => {
    const result = getDepartmentErrorMessage(new Error('violates foreign key'), fallback);
    expect(result).toContain('البيانات المرتبطة');
  });

  it('returns fallback for unknown error', () => {
    expect(getDepartmentErrorMessage(new Error('something random'), fallback)).toBe(fallback);
  });

  it('returns fallback for null', () => {
    expect(getDepartmentErrorMessage(null, fallback)).toBe(fallback);
  });

  it('returns fallback for undefined', () => {
    expect(getDepartmentErrorMessage(undefined, fallback)).toBe(fallback);
  });

  it('returns fallback for non-object error', () => {
    expect(getDepartmentErrorMessage('string error', fallback)).toBe(fallback);
  });
});

// ---------------------------------------------------------------------------
// getAddUserErrorMessage
// ---------------------------------------------------------------------------

describe('getAddUserErrorMessage', () => {
  it('maps response code DUPLICATE_EMAIL', () => {
    const result = getAddUserErrorMessage(null, { error: 'dup', code: 'DUPLICATE_EMAIL' });
    expect(result).toContain('مسجل مسبقاً');
  });

  it('maps response code INVALID_EMAIL', () => {
    const result = getAddUserErrorMessage(null, { error: 'bad', code: 'INVALID_EMAIL' });
    expect(result).toContain('غير صالح');
  });

  it('falls back to response.error string when code is unknown', () => {
    const result = getAddUserErrorMessage(null, { error: 'custom message', code: 'UNKNOWN_CODE' });
    expect(result).toBe('custom message');
  });

  it('maps error object code', () => {
    const result = getAddUserErrorMessage({ code: 'UNAUTHORIZED' });
    expect(result).toContain('غير مصرح');
  });

  it('detects duplicate via message regex', () => {
    const result = getAddUserErrorMessage(new Error('already been registered'));
    expect(result).toContain('مسجل مسبقاً');
  });

  it('detects permission denied via message regex', () => {
    const result = getAddUserErrorMessage(new Error('permission denied'));
    expect(result).toContain('صلاحية');
  });

  it('returns default fallback when no match', () => {
    expect(getAddUserErrorMessage(new Error('unknown'))).toBe('فشل إضافة المستخدم');
  });

  it('returns custom fallback', () => {
    expect(getAddUserErrorMessage(null, null, 'custom fallback')).toBe('custom fallback');
  });
});

// ---------------------------------------------------------------------------
// getDeleteUserErrorMessage
// ---------------------------------------------------------------------------

describe('getDeleteUserErrorMessage', () => {
  it('maps response code CANNOT_DELETE_SELF', () => {
    const result = getDeleteUserErrorMessage(null, { error: 'err', code: 'CANNOT_DELETE_SELF' });
    expect(result).toContain('لا يمكنك حذف حسابك');
  });

  it('maps response code CANNOT_DELETE_ADMIN', () => {
    const result = getDeleteUserErrorMessage(null, { error: 'err', code: 'CANNOT_DELETE_ADMIN' });
    expect(result).toContain('المدير العام');
  });

  it('maps error object code USER_NOT_FOUND', () => {
    const result = getDeleteUserErrorMessage({ code: 'USER_NOT_FOUND' });
    expect(result).toContain('غير موجود');
  });

  it('detects "not found" via message regex', () => {
    const result = getDeleteUserErrorMessage(new Error('user not found'));
    expect(result).toContain('غير موجود');
  });

  it('detects permission denied via message regex', () => {
    const result = getDeleteUserErrorMessage(new Error('RLS policy violation'));
    expect(result).toContain('صلاحية');
  });

  it('returns default fallback', () => {
    expect(getDeleteUserErrorMessage(new Error('xyz'))).toBe('فشل حذف المستخدم');
  });

  it('returns custom fallback', () => {
    expect(getDeleteUserErrorMessage(null, null, 'my fallback')).toBe('my fallback');
  });
});

// ---------------------------------------------------------------------------
// getProfileUpdateErrorMessage
// ---------------------------------------------------------------------------

describe('getProfileUpdateErrorMessage', () => {
  it('maps code 42501', () => {
    const result = getProfileUpdateErrorMessage({ code: '42501' });
    expect(result).toContain('صلاحية');
  });

  it('maps code 23503', () => {
    const result = getProfileUpdateErrorMessage({ code: '23503' });
    expect(result).toContain('البيانات المرتبطة');
  });

  it('maps code PGRST301', () => {
    const result = getProfileUpdateErrorMessage({ code: 'PGRST301' });
    expect(result).toContain('انتهت الجلسة');
  });

  it('detects permission denied via message', () => {
    const result = getProfileUpdateErrorMessage(new Error('RLS denied'));
    expect(result).toContain('صلاحية');
  });

  it('detects foreign key via message', () => {
    const result = getProfileUpdateErrorMessage(new Error('violates foreign key'));
    expect(result).toContain('البيانات المرتبطة');
  });

  it('returns default fallback', () => {
    expect(getProfileUpdateErrorMessage(new Error('unknown'))).toBe('فشل تحديث المستخدم');
  });

  it('returns custom fallback', () => {
    expect(getProfileUpdateErrorMessage(null, 'custom')).toBe('custom');
  });
});

// ---------------------------------------------------------------------------
// getGeneralManagerTransferErrorMessage
// ---------------------------------------------------------------------------

describe('getGeneralManagerTransferErrorMessage', () => {
  it.each([
    ['P0001', 'غير موجود'],
    ['P0002', 'نفس المؤسسة'],
    ['P0003', 'مدير عام'],
    ['P0004', 'غير مصرح'],
    ['P0006', 'صلاحية'],
    ['P0008', 'غير صالح'],
  ])('maps error code %s', (code, fragment) => {
    const result = getGeneralManagerTransferErrorMessage({ code });
    expect(result).toContain(fragment);
  });

  it('detects NOT_AUTHORIZED via message', () => {
    const result = getGeneralManagerTransferErrorMessage(new Error('NOT_AUTHORIZED'));
    expect(result).toContain('صلاحية');
  });

  it('detects GENERAL_MANAGER_CANDIDATE_INVALID via message', () => {
    const result = getGeneralManagerTransferErrorMessage(new Error('GENERAL_MANAGER_CANDIDATE_INVALID'));
    expect(result).toContain('غير صالح');
  });

  it('returns default fallback', () => {
    expect(getGeneralManagerTransferErrorMessage(new Error('xyz'))).toBe('فشل تغيير المدير العام');
  });

  it('returns custom fallback', () => {
    expect(getGeneralManagerTransferErrorMessage(null, 'custom')).toBe('custom');
  });
});
