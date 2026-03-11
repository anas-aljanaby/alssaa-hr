import { describe, it, expect } from 'vitest';
import {
  departments,
  users,
  leaveRequests,
  notifications,
  auditLogs,
  attendancePolicy,
  attendanceLogs,
  leaveBalances,
  getUserById,
  getDepartmentById,
  getUserAttendance,
  getUserLeaveBalance,
  getUserRequests,
  getUserNotifications,
  getDepartmentEmployees,
  getRequestTypeAr,
  getStatusAr,
  getAttendanceStatusAr,
  calculateLateMinutes,
  canAccessUserDetails,
  type RequestType,
  type RequestStatus,
  type AttendanceStatus,
} from '@/app/data/mockData';

// ---------------------------------------------------------------------------
// Structural integrity
// ---------------------------------------------------------------------------

describe('mockData structural integrity', () => {
  it('departments is non-empty', () => {
    expect(departments.length).toBeGreaterThan(0);
  });

  it('users is non-empty', () => {
    expect(users.length).toBeGreaterThan(0);
  });

  it('every user has required fields', () => {
    for (const u of users) {
      expect(u.uid).toBeTruthy();
      expect(u.email).toBeTruthy();
      expect(['employee', 'manager', 'admin']).toContain(u.role);
    }
  });

  it('every user has a unique uid', () => {
    const ids = users.map((u) => u.uid);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every department.managerUid references an existing user', () => {
    for (const dept of departments) {
      const manager = users.find((u) => u.uid === dept.managerUid);
      expect(manager, `Department ${dept.id} references unknown user ${dept.managerUid}`).toBeDefined();
    }
  });

  it('attendanceLogs is non-empty', () => {
    expect(attendanceLogs.length).toBeGreaterThan(0);
  });

  it('leaveRequests is non-empty', () => {
    expect(leaveRequests.length).toBeGreaterThan(0);
  });

  it('notifications is non-empty', () => {
    expect(notifications.length).toBeGreaterThan(0);
  });

  it('auditLogs is non-empty', () => {
    expect(auditLogs.length).toBeGreaterThan(0);
  });

  it('leaveBalances is non-empty', () => {
    expect(leaveBalances.length).toBeGreaterThan(0);
  });

  it('attendancePolicy has expected shape', () => {
    expect(attendancePolicy.workStartTime).toBeTruthy();
    expect(attendancePolicy.workEndTime).toBeTruthy();
    expect(attendancePolicy.gracePeriodMinutes).toBeGreaterThanOrEqual(0);
    expect(attendancePolicy.weeklyOffDays).toBeInstanceOf(Array);
  });
});

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

describe('getUserById', () => {
  it('finds an existing user', () => {
    const u = getUserById('user-1');
    expect(u).toBeDefined();
    expect(u!.uid).toBe('user-1');
  });

  it('returns undefined for unknown uid', () => {
    expect(getUserById('nonexistent')).toBeUndefined();
  });
});

describe('getDepartmentById', () => {
  it('finds an existing department', () => {
    const d = getDepartmentById('dept-1');
    expect(d).toBeDefined();
    expect(d!.id).toBe('dept-1');
  });

  it('returns undefined for unknown id', () => {
    expect(getDepartmentById('nonexistent')).toBeUndefined();
  });
});

describe('getUserAttendance', () => {
  it('returns logs for a known user', () => {
    const logs = getUserAttendance('user-3');
    expect(logs.length).toBeGreaterThanOrEqual(0);
    for (const log of logs) {
      expect(log.userId).toBe('user-3');
    }
  });

  it('returns empty for unknown user', () => {
    expect(getUserAttendance('nonexistent')).toEqual([]);
  });
});

describe('getUserLeaveBalance', () => {
  it('returns a balance for a non-admin user', () => {
    const b = getUserLeaveBalance('user-3');
    expect(b).toBeDefined();
    expect(b!.userId).toBe('user-3');
  });
});

describe('getUserRequests', () => {
  it('returns requests for user-3', () => {
    const reqs = getUserRequests('user-3');
    expect(reqs.length).toBeGreaterThan(0);
    for (const r of reqs) expect(r.userId).toBe('user-3');
  });
});

describe('getUserNotifications', () => {
  it('returns notifications for user-3', () => {
    const notifs = getUserNotifications('user-3');
    expect(notifs.length).toBeGreaterThan(0);
    for (const n of notifs) expect(n.userId).toBe('user-3');
  });
});

describe('getDepartmentEmployees', () => {
  it('returns non-admin users in a department', () => {
    const emps = getDepartmentEmployees('dept-1');
    expect(emps.length).toBeGreaterThan(0);
    for (const e of emps) {
      expect(e.departmentId).toBe('dept-1');
      expect(e.role).not.toBe('admin');
    }
  });
});

// ---------------------------------------------------------------------------
// Translation helpers
// ---------------------------------------------------------------------------

describe('getRequestTypeAr', () => {
  it.each<RequestType>(['annual_leave', 'sick_leave', 'hourly_permission', 'time_adjustment', 'overtime'])(
    'returns Arabic string for "%s"',
    (type) => {
      const result = getRequestTypeAr(type);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    },
  );
});

describe('getStatusAr', () => {
  it.each<RequestStatus>(['pending', 'approved', 'rejected'])('returns Arabic string for "%s"', (status) => {
    const result = getStatusAr(status);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('getAttendanceStatusAr', () => {
  it.each<AttendanceStatus>(['present', 'late', 'absent', 'on_leave'])(
    'returns Arabic string for "%s"',
    (status) => {
      const result = getAttendanceStatusAr(status);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    },
  );
});

// ---------------------------------------------------------------------------
// calculateLateMinutes
// ---------------------------------------------------------------------------

describe('calculateLateMinutes', () => {
  it('returns 0 when on time', () => {
    expect(calculateLateMinutes('08:05', '08:00', 10)).toBe(0);
  });

  it('returns 0 when exactly at grace boundary', () => {
    expect(calculateLateMinutes('08:10', '08:00', 10)).toBe(0);
  });

  it('returns positive minutes when late', () => {
    expect(calculateLateMinutes('08:20', '08:00', 10)).toBe(10);
  });

  it('returns 0 when early', () => {
    expect(calculateLateMinutes('07:50', '08:00', 10)).toBe(0);
  });

  it('uses default work start and grace period', () => {
    expect(calculateLateMinutes('08:30')).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// canAccessUserDetails
// ---------------------------------------------------------------------------

describe('canAccessUserDetails', () => {
  const admin = users.find((u) => u.role === 'admin')!;
  const manager = users.find((u) => u.role === 'manager')!;
  const employee = users.find((u) => u.role === 'employee')!;
  const sameDepEmployee = users.find(
    (u) => u.role === 'employee' && u.departmentId === manager.departmentId,
  )!;
  const otherDepEmployee = users.find(
    (u) => u.role === 'employee' && u.departmentId !== manager.departmentId,
  )!;

  it('admin can access any user', () => {
    expect(canAccessUserDetails(admin, employee.uid)).toBe(true);
    expect(canAccessUserDetails(admin, manager.uid)).toBe(true);
  });

  it('employee can access only self', () => {
    expect(canAccessUserDetails(employee, employee.uid)).toBe(true);
    expect(canAccessUserDetails(employee, admin.uid)).toBe(false);
  });

  it('manager can access users in their department', () => {
    expect(canAccessUserDetails(manager, sameDepEmployee.uid)).toBe(true);
  });

  it('manager cannot access users in other departments', () => {
    expect(canAccessUserDetails(manager, otherDepEmployee.uid)).toBe(false);
  });

  it('returns false for nonexistent target (manager case)', () => {
    expect(canAccessUserDetails(manager, 'nonexistent')).toBe(false);
  });
});
