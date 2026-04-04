import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  setPasswordSchema,
  changePasswordSchema,
  leaveRequestSchema,
  approvalSchema,
  addUserSchema,
  updateProfileSchema,
  createDepartmentSchema,
  updateDepartmentSchema,
} from '@/lib/validations';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function errorPaths(result: { success: false; error: { issues: { path: (string | number)[] }[] } }) {
  return result.error.issues.map((i) => i.path.join('.'));
}

function errorAt(
  result: { success: false; error: { issues: { path: (string | number)[]; message: string }[] } },
  path: string,
) {
  return result.error.issues.find((i) => i.path.join('.') === path)?.message;
}

const STRONG_PW = 'Abc12345';

// ---------------------------------------------------------------------------
// loginSchema
// ---------------------------------------------------------------------------

describe('loginSchema', () => {
  it('passes with valid email + password', () => {
    const r = loginSchema.safeParse({ email: 'a@b.com', password: 'x' });
    expect(r.success).toBe(true);
  });

  it('rejects missing email', () => {
    const r = loginSchema.safeParse({ email: '', password: 'x' });
    expect(r.success).toBe(false);
    if (!r.success) expect(errorPaths(r)).toContain('email');
  });

  it('rejects invalid email format', () => {
    const r = loginSchema.safeParse({ email: 'not-email', password: 'x' });
    expect(r.success).toBe(false);
  });

  it('rejects missing password', () => {
    const r = loginSchema.safeParse({ email: 'a@b.com', password: '' });
    expect(r.success).toBe(false);
    if (!r.success) expect(errorPaths(r)).toContain('password');
  });
});

// ---------------------------------------------------------------------------
// setPasswordSchema
// ---------------------------------------------------------------------------

describe('setPasswordSchema', () => {
  it('passes when passwords match', () => {
    const r = setPasswordSchema.safeParse({ password: STRONG_PW, confirmPassword: STRONG_PW });
    expect(r.success).toBe(true);
  });

  it('rejects mismatched confirmPassword', () => {
    const r = setPasswordSchema.safeParse({ password: STRONG_PW, confirmPassword: 'Different1' });
    expect(r.success).toBe(false);
    if (!r.success) expect(errorAt(r, 'confirmPassword')).toContain('غير متطابقتين');
  });

  it('rejects empty confirmPassword', () => {
    const r = setPasswordSchema.safeParse({ password: STRONG_PW, confirmPassword: '' });
    expect(r.success).toBe(false);
    if (!r.success) expect(errorPaths(r)).toContain('confirmPassword');
  });

  it('rejects weak password even when both match', () => {
    const r = setPasswordSchema.safeParse({ password: 'weak', confirmPassword: 'weak' });
    expect(r.success).toBe(false);
    if (!r.success) expect(errorPaths(r)).toContain('password');
  });
});

// ---------------------------------------------------------------------------
// changePasswordSchema
// ---------------------------------------------------------------------------

describe('changePasswordSchema', () => {
  const valid = { currentPassword: 'old', newPassword: STRONG_PW, confirmPassword: STRONG_PW };

  it('passes with valid data', () => {
    expect(changePasswordSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects empty currentPassword', () => {
    const r = changePasswordSchema.safeParse({ ...valid, currentPassword: '' });
    expect(r.success).toBe(false);
    if (!r.success) expect(errorPaths(r)).toContain('currentPassword');
  });

  it('rejects mismatched confirm', () => {
    const r = changePasswordSchema.safeParse({ ...valid, confirmPassword: 'Nope1234' });
    expect(r.success).toBe(false);
    if (!r.success) expect(errorAt(r, 'confirmPassword')).toContain('غير متطابقتين');
  });

  it('rejects weak newPassword', () => {
    const r = changePasswordSchema.safeParse({ ...valid, newPassword: 'weak', confirmPassword: 'weak' });
    expect(r.success).toBe(false);
    if (!r.success) expect(errorPaths(r)).toContain('newPassword');
  });
});

// ---------------------------------------------------------------------------
// leaveRequestSchema
// ---------------------------------------------------------------------------

describe('leaveRequestSchema', () => {
  describe('annual_leave / sick_leave (full-day)', () => {
    const base = { type: 'annual_leave' as const, fromDate: '2025-06-01' };

    it('passes with valid toDate', () => {
      const r = leaveRequestSchema.safeParse({ ...base, toDate: '2025-06-03' });
      expect(r.success).toBe(true);
    });

    it('rejects missing toDate', () => {
      const r = leaveRequestSchema.safeParse(base);
      expect(r.success).toBe(false);
      if (!r.success) expect(errorPaths(r)).toContain('toDate');
    });

    it('rejects toDate before fromDate', () => {
      const r = leaveRequestSchema.safeParse({ ...base, toDate: '2025-05-01' });
      expect(r.success).toBe(false);
      if (!r.success) expect(errorAt(r, 'toDate')).toContain('بعد تاريخ البداية');
    });

    it('accepts same-day range', () => {
      const r = leaveRequestSchema.safeParse({ ...base, toDate: '2025-06-01' });
      expect(r.success).toBe(true);
    });

    it('works for sick_leave too', () => {
      const r = leaveRequestSchema.safeParse({ type: 'sick_leave', fromDate: '2025-06-01', toDate: '2025-06-02' });
      expect(r.success).toBe(true);
    });
  });

  describe('hourly_permission', () => {
    const base = { type: 'hourly_permission' as const, fromDate: '2025-06-01' };

    it('passes with all time fields', () => {
      const r = leaveRequestSchema.safeParse({
        ...base,
        fromTime: '09:00',
        toDate: '2025-06-01',
        toTime: '11:00',
      });
      expect(r.success).toBe(true);
    });

    it('rejects missing fromTime', () => {
      const r = leaveRequestSchema.safeParse({ ...base, toDate: '2025-06-01', toTime: '11:00' });
      expect(r.success).toBe(false);
      if (!r.success) expect(errorPaths(r)).toContain('fromTime');
    });

    it('rejects missing toDate', () => {
      const r = leaveRequestSchema.safeParse({ ...base, fromTime: '09:00', toTime: '11:00' });
      expect(r.success).toBe(false);
      if (!r.success) expect(errorPaths(r)).toContain('toDate');
    });

    it('rejects missing toTime', () => {
      const r = leaveRequestSchema.safeParse({ ...base, fromTime: '09:00', toDate: '2025-06-01' });
      expect(r.success).toBe(false);
      if (!r.success) expect(errorPaths(r)).toContain('toTime');
    });

    it('rejects to <= from (same time)', () => {
      const r = leaveRequestSchema.safeParse({
        ...base,
        fromTime: '10:00',
        toDate: '2025-06-01',
        toTime: '10:00',
      });
      expect(r.success).toBe(false);
      if (!r.success) expect(errorAt(r, 'toDate')).toContain('بعد البداية');
    });

    it('rejects to before from', () => {
      const r = leaveRequestSchema.safeParse({
        ...base,
        fromTime: '14:00',
        toDate: '2025-06-01',
        toTime: '09:00',
      });
      expect(r.success).toBe(false);
    });
  });

  describe('time_adjustment', () => {
    it('passes with just type + fromDate (no extra validation)', () => {
      const r = leaveRequestSchema.safeParse({ type: 'time_adjustment', fromDate: '2025-06-01' });
      expect(r.success).toBe(true);
    });
  });

  it('rejects missing fromDate', () => {
    const r = leaveRequestSchema.safeParse({ type: 'annual_leave', fromDate: '' });
    expect(r.success).toBe(false);
    if (!r.success) expect(errorPaths(r)).toContain('fromDate');
  });

  it('rejects invalid type', () => {
    const r = leaveRequestSchema.safeParse({ type: 'vacation', fromDate: '2025-06-01' });
    expect(r.success).toBe(false);
    if (!r.success) expect(errorPaths(r)).toContain('type');
  });
});

// ---------------------------------------------------------------------------
// approvalSchema
// ---------------------------------------------------------------------------

describe('approvalSchema', () => {
  it('passes with no comment', () => {
    expect(approvalSchema.safeParse({}).success).toBe(true);
  });

  it('passes with a comment', () => {
    expect(approvalSchema.safeParse({ comment: 'ok' }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// addUserSchema
// ---------------------------------------------------------------------------

describe('addUserSchema', () => {
  const valid = {
    name: 'Ali',
    email: 'a@b.com',
    password: STRONG_PW,
    department_id: 'dept-1',
  };

  it('passes with valid data', () => {
    expect(addUserSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects name shorter than 2', () => {
    const r = addUserSchema.safeParse({ ...valid, name: 'A' });
    expect(r.success).toBe(false);
  });

  it('rejects empty email', () => {
    const r = addUserSchema.safeParse({ ...valid, email: '' });
    expect(r.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const r = addUserSchema.safeParse({ ...valid, email: 'bad' });
    expect(r.success).toBe(false);
  });

  it('accepts empty department_id (none)', () => {
    const r = addUserSchema.safeParse({ ...valid, department_id: '' });
    expect(r.success).toBe(true);
  });

  it('rejects weak password', () => {
    const r = addUserSchema.safeParse({ ...valid, password: 'weak' });
    expect(r.success).toBe(false);
    if (!r.success) expect(errorPaths(r)).toContain('password');
  });
});

// ---------------------------------------------------------------------------
// updateProfileSchema
// ---------------------------------------------------------------------------

describe('updateProfileSchema', () => {
  const valid = {
    name_ar: 'علي',
    email: 'user@example.com',
    role: 'employee' as const,
    department_id: 'dept-1',
  };

  it('passes with minimal valid data', () => {
    expect(updateProfileSchema.safeParse(valid).success).toBe(true);
  });

  it('passes with empty department_id (no department)', () => {
    const r = updateProfileSchema.safeParse({ ...valid, department_id: '' });
    expect(r.success).toBe(true);
  });

  it('passes with valid work schedule', () => {
    const r = updateProfileSchema.safeParse({
      ...valid,
      work_days: [0, 1, 2, 3, 4],
      work_start_time: '08:00',
      work_end_time: '16:00',
    });
    expect(r.success).toBe(true);
  });

  it('rejects work_days without start/end times', () => {
    const r = updateProfileSchema.safeParse({ ...valid, work_days: [0, 1] });
    expect(r.success).toBe(false);
    if (!r.success) expect(errorPaths(r)).toContain('work_end_time');
  });

  it('rejects work_end_time before start_time', () => {
    const r = updateProfileSchema.safeParse({
      ...valid,
      work_days: [0],
      work_start_time: '16:00',
      work_end_time: '08:00',
    });
    expect(r.success).toBe(false);
  });

  it('rejects equal start and end times', () => {
    const r = updateProfileSchema.safeParse({
      ...valid,
      work_days: [0],
      work_start_time: '10:00',
      work_end_time: '10:00',
    });
    expect(r.success).toBe(false);
  });

  it('rejects invalid time format in work_start_time', () => {
    const r = updateProfileSchema.safeParse({
      ...valid,
      work_days: [0],
      work_start_time: '25:00',
      work_end_time: '16:00',
    });
    expect(r.success).toBe(false);
  });

  it('passes when work_days is empty (no schedule constraint)', () => {
    const r = updateProfileSchema.safeParse({ ...valid, work_days: [] });
    expect(r.success).toBe(true);
  });

  it('accepts all three roles', () => {
    for (const role of ['employee', 'manager', 'admin'] as const) {
      expect(updateProfileSchema.safeParse({ ...valid, role }).success).toBe(true);
    }
  });

  it('rejects invalid email format', () => {
    const r = updateProfileSchema.safeParse({ ...valid, email: 'bad-email' });
    expect(r.success).toBe(false);
    if (!r.success) expect(errorPaths(r)).toContain('email');
  });

  it('rejects work_day outside 0-6', () => {
    const r = updateProfileSchema.safeParse({
      ...valid,
      work_days: [7],
      work_start_time: '08:00',
      work_end_time: '16:00',
    });
    expect(r.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createDepartmentSchema / updateDepartmentSchema
// ---------------------------------------------------------------------------

describe.each([
  ['createDepartmentSchema', createDepartmentSchema],
  ['updateDepartmentSchema', updateDepartmentSchema],
] as const)('%s', (_name, schema) => {
  const valid = { nameAr: 'قسم التقنية', nameEn: 'Tech Dept' };

  it('passes with valid names', () => {
    const r = schema.safeParse(valid);
    expect(r.success).toBe(true);
  });

  it('trims whitespace from names', () => {
    const r = schema.safeParse({ nameAr: '  قسم  ', nameEn: '  Tech  ' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.nameAr).toBe('قسم');
      expect(r.data.nameEn).toBe('Tech');
    }
  });

  it('rejects empty nameAr', () => {
    const r = schema.safeParse({ ...valid, nameAr: '' });
    expect(r.success).toBe(false);
    if (!r.success) expect(errorPaths(r)).toContain('nameAr');
  });

  it('allows empty nameEn (optional English name)', () => {
    const r = schema.safeParse({ ...valid, nameEn: '' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.nameEn).toBeNull();
  });

  it('trims whitespace-only nameEn to null', () => {
    const r = schema.safeParse({ ...valid, nameEn: '   ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.nameEn).toBeNull();
  });

  it('rejects name longer than 100 chars', () => {
    const r = schema.safeParse({ ...valid, nameAr: 'x'.repeat(101) });
    expect(r.success).toBe(false);
  });

  it('transforms empty managerId to undefined', () => {
    const r = schema.safeParse({ ...valid, managerId: '' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.managerId).toBeUndefined();
  });

  it('keeps non-empty managerId', () => {
    const r = schema.safeParse({ ...valid, managerId: 'uuid-123' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.managerId).toBe('uuid-123');
  });
});
