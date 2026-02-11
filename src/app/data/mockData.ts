// Mock Data for Alssaa Media Network Attendance System

export type UserRole = 'employee' | 'manager' | 'admin';
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'on_leave';
export type RequestType = 'annual_leave' | 'sick_leave' | 'hourly_permission' | 'time_adjustment';
export type RequestStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  uid: string;
  employeeId: string;
  name: string;
  nameAr: string;
  email: string;
  phone: string;
  role: UserRole;
  departmentId: string;
  status: 'active' | 'inactive';
  avatar?: string;
  joinDate: string;
}

export interface Department {
  id: string;
  name: string;
  nameAr: string;
  managerUid: string;
}

export interface AttendanceLog {
  id: string;
  userId: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  checkInLocation?: { lat: number; lng: number };
  checkOutLocation?: { lat: number; lng: number };
  status: AttendanceStatus;
}

export interface LeaveBalance {
  userId: string;
  totalAnnual: number;
  usedAnnual: number;
  remainingAnnual: number;
  totalSick: number;
  usedSick: number;
  remainingSick: number;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  type: RequestType;
  fromDateTime: string;
  toDateTime: string;
  note: string;
  status: RequestStatus;
  approverId?: string;
  decisionNote?: string;
  createdAt: string;
  attachment?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  titleAr: string;
  message: string;
  messageAr: string;
  readStatus: boolean;
  createdAt: string;
  type: 'request_update' | 'attendance' | 'system' | 'approval';
}

export interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  actionAr: string;
  targetId: string;
  targetType: string;
  timestamp: string;
  details?: string;
}

export interface AttendancePolicy {
  id: string;
  workStartTime: string;
  workEndTime: string;
  gracePeriodMinutes: number;
  weeklyOffDays: number[];
  maxLateDaysBeforeWarning: number;
  absentCutoffTime: string;
  annualLeavePerYear: number;
  sickLeavePerYear: number;
}

// Departments
export const departments: Department[] = [
  { id: 'dept-1', name: 'News Department', nameAr: 'قسم الأخبار', managerUid: 'user-2' },
  { id: 'dept-2', name: 'Technical Department', nameAr: 'القسم التقني', managerUid: 'user-5' },
  { id: 'dept-3', name: 'Marketing Department', nameAr: 'قسم التسويق', managerUid: 'user-6' },
  { id: 'dept-4', name: 'Finance Department', nameAr: 'القسم المالي', managerUid: 'user-7' },
  { id: 'dept-5', name: 'HR Department', nameAr: 'قسم الموارد البشرية', managerUid: 'user-8' },
];

// Users
export const users: User[] = [
  {
    uid: 'user-1',
    employeeId: 'EMP-001',
    name: 'Ahmed Hassan',
    nameAr: 'أحمد حسن',
    email: 'ahmed@alssaa.tv',
    phone: '+964 770 123 4567',
    role: 'admin',
    departmentId: 'dept-5',
    status: 'active',
    joinDate: '2020-01-15',
  },
  {
    uid: 'user-2',
    employeeId: 'EMP-002',
    name: 'Sara Ali',
    nameAr: 'سارة علي',
    email: 'sara@alssaa.tv',
    phone: '+964 770 234 5678',
    role: 'manager',
    departmentId: 'dept-1',
    status: 'active',
    joinDate: '2020-03-20',
  },
  {
    uid: 'user-3',
    employeeId: 'EMP-003',
    name: 'Mohammed Karim',
    nameAr: 'محمد كريم',
    email: 'mohammed@alssaa.tv',
    phone: '+964 770 345 6789',
    role: 'employee',
    departmentId: 'dept-1',
    status: 'active',
    joinDate: '2021-06-01',
  },
  {
    uid: 'user-4',
    employeeId: 'EMP-004',
    name: 'Fatima Nouri',
    nameAr: 'فاطمة نوري',
    email: 'fatima@alssaa.tv',
    phone: '+964 770 456 7890',
    role: 'employee',
    departmentId: 'dept-1',
    status: 'active',
    joinDate: '2021-09-15',
  },
  {
    uid: 'user-5',
    employeeId: 'EMP-005',
    name: 'Ali Mahmoud',
    nameAr: 'علي محمود',
    email: 'ali@alssaa.tv',
    phone: '+964 770 567 8901',
    role: 'manager',
    departmentId: 'dept-2',
    status: 'active',
    joinDate: '2020-02-10',
  },
  {
    uid: 'user-6',
    employeeId: 'EMP-006',
    name: 'Nour Saleh',
    nameAr: 'نور صالح',
    email: 'nour@alssaa.tv',
    phone: '+964 770 678 9012',
    role: 'manager',
    departmentId: 'dept-3',
    status: 'active',
    joinDate: '2020-05-01',
  },
  {
    uid: 'user-7',
    employeeId: 'EMP-007',
    name: 'Hassan Jabbar',
    nameAr: 'حسن جبار',
    email: 'hassan.j@alssaa.tv',
    phone: '+964 770 789 0123',
    role: 'manager',
    departmentId: 'dept-4',
    status: 'active',
    joinDate: '2020-04-15',
  },
  {
    uid: 'user-8',
    employeeId: 'EMP-008',
    name: 'Zainab Ridha',
    nameAr: 'زينب رضا',
    email: 'zainab@alssaa.tv',
    phone: '+964 770 890 1234',
    role: 'manager',
    departmentId: 'dept-5',
    status: 'active',
    joinDate: '2020-01-20',
  },
  {
    uid: 'user-9',
    employeeId: 'EMP-009',
    name: 'Omar Faisal',
    nameAr: 'عمر فيصل',
    email: 'omar@alssaa.tv',
    phone: '+964 770 901 2345',
    role: 'employee',
    departmentId: 'dept-2',
    status: 'active',
    joinDate: '2022-01-10',
  },
  {
    uid: 'user-10',
    employeeId: 'EMP-010',
    name: 'Layla Ibrahim',
    nameAr: 'ليلى إبراهيم',
    email: 'layla@alssaa.tv',
    phone: '+964 770 012 3456',
    role: 'employee',
    departmentId: 'dept-3',
    status: 'active',
    joinDate: '2022-03-01',
  },
  {
    uid: 'user-11',
    employeeId: 'EMP-011',
    name: 'Yusuf Tariq',
    nameAr: 'يوسف طارق',
    email: 'yusuf@alssaa.tv',
    phone: '+964 770 111 2222',
    role: 'employee',
    departmentId: 'dept-2',
    status: 'active',
    joinDate: '2022-06-15',
  },
  {
    uid: 'user-12',
    employeeId: 'EMP-012',
    name: 'Maryam Qasim',
    nameAr: 'مريم قاسم',
    email: 'maryam@alssaa.tv',
    phone: '+964 770 333 4444',
    role: 'employee',
    departmentId: 'dept-4',
    status: 'active',
    joinDate: '2023-01-10',
  },
];

// Generate attendance logs for the current month
function generateAttendanceLogs(): AttendanceLog[] {
  const logs: AttendanceLog[] = [];
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const employeeUsers = users.filter(u => u.role === 'employee' || u.role === 'manager');

  for (const user of employeeUsers) {
    for (let day = 1; day <= today.getDate(); day++) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();

      // Skip Friday and Saturday (Iraqi weekend)
      if (dayOfWeek === 5 || dayOfWeek === 6) continue;

      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const rand = Math.random();

      let status: AttendanceStatus;
      let checkInTime: string | null = null;
      let checkOutTime: string | null = null;

      if (rand < 0.65) {
        // Present - check in on time
        const hour = 8;
        const min = Math.floor(Math.random() * 10);
        checkInTime = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
        checkOutTime = `${16 + Math.floor(Math.random() * 2)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`;
        status = 'present';
      } else if (rand < 0.85) {
        // Late
        const hour = 8 + Math.floor(Math.random() * 2) + 1;
        const min = Math.floor(Math.random() * 60);
        checkInTime = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
        checkOutTime = `${16 + Math.floor(Math.random() * 2)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`;
        status = 'late';
      } else if (rand < 0.93) {
        // Absent
        status = 'absent';
      } else {
        // On leave
        status = 'on_leave';
      }

      logs.push({
        id: `att-${user.uid}-${dateStr}`,
        userId: user.uid,
        date: dateStr,
        checkInTime,
        checkOutTime,
        status,
        checkInLocation: checkInTime ? { lat: 33.3152, lng: 44.3661 } : undefined,
        checkOutLocation: checkOutTime ? { lat: 33.3152, lng: 44.3661 } : undefined,
      });
    }
  }

  return logs;
}

export const attendanceLogs: AttendanceLog[] = generateAttendanceLogs();

// Leave Balances
export const leaveBalances: LeaveBalance[] = users
  .filter(u => u.role !== 'admin')
  .map(user => ({
    userId: user.uid,
    totalAnnual: 21,
    usedAnnual: Math.floor(Math.random() * 10),
    remainingAnnual: 21 - Math.floor(Math.random() * 10),
    totalSick: 14,
    usedSick: Math.floor(Math.random() * 5),
    remainingSick: 14 - Math.floor(Math.random() * 5),
  }));

// Leave Requests
export const leaveRequests: LeaveRequest[] = [
  {
    id: 'req-1',
    userId: 'user-3',
    type: 'annual_leave',
    fromDateTime: '2026-02-22T08:00:00',
    toDateTime: '2026-02-24T16:00:00',
    note: 'إجازة عائلية',
    status: 'pending',
    createdAt: '2026-02-18T10:30:00',
  },
  {
    id: 'req-2',
    userId: 'user-4',
    type: 'sick_leave',
    fromDateTime: '2026-02-17T08:00:00',
    toDateTime: '2026-02-17T16:00:00',
    note: 'مراجعة طبية',
    status: 'approved',
    approverId: 'user-2',
    decisionNote: 'تمت الموافقة، سلامات',
    createdAt: '2026-02-16T14:00:00',
  },
  {
    id: 'req-3',
    userId: 'user-9',
    type: 'hourly_permission',
    fromDateTime: '2026-02-19T14:00:00',
    toDateTime: '2026-02-19T16:00:00',
    note: 'موعد في السفارة',
    status: 'pending',
    createdAt: '2026-02-18T09:00:00',
  },
  {
    id: 'req-4',
    userId: 'user-10',
    type: 'time_adjustment',
    fromDateTime: '2026-02-15T08:00:00',
    toDateTime: '2026-02-15T08:30:00',
    note: 'نسيت تسجيل الحضور - كنت موجود من الساعة 8',
    status: 'rejected',
    approverId: 'user-6',
    decisionNote: 'لم يتم التأكد من الحضور',
    createdAt: '2026-02-15T12:00:00',
  },
  {
    id: 'req-5',
    userId: 'user-3',
    type: 'annual_leave',
    fromDateTime: '2026-03-01T08:00:00',
    toDateTime: '2026-03-05T16:00:00',
    note: 'سفر خارج البلاد',
    status: 'pending',
    createdAt: '2026-02-19T08:00:00',
  },
  {
    id: 'req-6',
    userId: 'user-11',
    type: 'sick_leave',
    fromDateTime: '2026-02-18T08:00:00',
    toDateTime: '2026-02-19T16:00:00',
    note: 'حالة صحية طارئة',
    status: 'pending',
    createdAt: '2026-02-18T07:00:00',
  },
  {
    id: 'req-7',
    userId: 'user-12',
    type: 'annual_leave',
    fromDateTime: '2026-02-25T08:00:00',
    toDateTime: '2026-02-26T16:00:00',
    note: 'مناسبة عائلية',
    status: 'pending',
    createdAt: '2026-02-19T11:00:00',
  },
];

// Notifications
export const notifications: Notification[] = [
  {
    id: 'notif-1',
    userId: 'user-3',
    title: 'Leave Request Update',
    titleAr: 'تحديث طلب الإجازة',
    message: 'Your annual leave request for Feb 22-24 is pending review',
    messageAr: 'طلب إجازتك السنوية من 22-24 فبراير قيد المراجعة',
    readStatus: false,
    createdAt: '2026-02-18T10:35:00',
    type: 'request_update',
  },
  {
    id: 'notif-2',
    userId: 'user-3',
    title: 'Late Arrival Warning',
    titleAr: 'تنبيه تأخر',
    message: 'You have been late 3 times this month',
    messageAr: 'لقد تأخرت 3 مرات هذا الشهر',
    readStatus: false,
    createdAt: '2026-02-17T09:00:00',
    type: 'attendance',
  },
  {
    id: 'notif-3',
    userId: 'user-2',
    title: 'New Leave Request',
    titleAr: 'طلب إجازة جديد',
    message: 'Mohammed Karim submitted an annual leave request',
    messageAr: 'محمد كريم قدم طلب إجازة سنوية',
    readStatus: false,
    createdAt: '2026-02-18T10:30:00',
    type: 'approval',
  },
  {
    id: 'notif-4',
    userId: 'user-2',
    title: 'Pending Approval',
    titleAr: 'بانتظار الموافقة',
    message: 'You have 2 pending requests to review',
    messageAr: 'لديك طلبان بانتظار المراجعة',
    readStatus: true,
    createdAt: '2026-02-17T08:00:00',
    type: 'approval',
  },
  {
    id: 'notif-5',
    userId: 'user-1',
    title: 'System Update',
    titleAr: 'تحديث النظام',
    message: 'Attendance policy has been updated successfully',
    messageAr: 'تم تحديث سياسة الحضور بنجاح',
    readStatus: true,
    createdAt: '2026-02-16T12:00:00',
    type: 'system',
  },
  {
    id: 'notif-6',
    userId: 'user-4',
    title: 'Leave Approved',
    titleAr: 'تمت الموافقة على الإجازة',
    message: 'Your sick leave for Feb 17 has been approved',
    messageAr: 'تمت الموافقة على إجازتك المرضية ليوم 17 فبراير',
    readStatus: false,
    createdAt: '2026-02-16T15:00:00',
    type: 'request_update',
  },
];

// Audit Logs
export const auditLogs: AuditLog[] = [
  {
    id: 'audit-1',
    actorId: 'user-1',
    action: 'Updated attendance policy',
    actionAr: 'تحديث سياسة الحضور',
    targetId: 'policy-1',
    targetType: 'policy',
    timestamp: '2026-02-19T08:00:00',
    details: 'Changed grace period from 15 to 10 minutes',
  },
  {
    id: 'audit-2',
    actorId: 'user-2',
    action: 'Approved leave request',
    actionAr: 'الموافقة على طلب إجازة',
    targetId: 'req-2',
    targetType: 'request',
    timestamp: '2026-02-16T14:30:00',
  },
  {
    id: 'audit-3',
    actorId: 'user-1',
    action: 'Created new user',
    actionAr: 'إنشاء مستخدم جديد',
    targetId: 'user-12',
    targetType: 'user',
    timestamp: '2026-02-15T10:00:00',
    details: 'Added Maryam Qasim to Finance Department',
  },
  {
    id: 'audit-4',
    actorId: 'user-6',
    action: 'Rejected time adjustment',
    actionAr: 'رفض طلب تعديل وقت',
    targetId: 'req-4',
    targetType: 'request',
    timestamp: '2026-02-15T13:00:00',
  },
  {
    id: 'audit-5',
    actorId: 'user-1',
    action: 'Updated department',
    actionAr: 'تحديث قسم',
    targetId: 'dept-3',
    targetType: 'department',
    timestamp: '2026-02-14T09:00:00',
    details: 'Changed department manager',
  },
  {
    id: 'audit-6',
    actorId: 'user-3',
    action: 'Checked in',
    actionAr: 'تسجيل حضور',
    targetId: 'user-3',
    targetType: 'attendance',
    timestamp: '2026-02-19T08:05:00',
  },
  {
    id: 'audit-7',
    actorId: 'user-1',
    action: 'Generated monthly report',
    actionAr: 'إنشاء تقرير شهري',
    targetId: 'report-feb-2026',
    targetType: 'report',
    timestamp: '2026-02-18T16:00:00',
  },
];

// Attendance Policy
export const attendancePolicy: AttendancePolicy = {
  id: 'policy-1',
  workStartTime: '08:00',
  workEndTime: '16:00',
  gracePeriodMinutes: 10,
  weeklyOffDays: [5, 6], // Friday, Saturday
  maxLateDaysBeforeWarning: 3,
  absentCutoffTime: '10:00',
  annualLeavePerYear: 21,
  sickLeavePerYear: 14,
};

// Helper functions
export function getUserById(uid: string): User | undefined {
  return users.find(u => u.uid === uid);
}

export function getDepartmentById(id: string): Department | undefined {
  return departments.find(d => d.id === id);
}

export function getUserAttendance(userId: string): AttendanceLog[] {
  return attendanceLogs.filter(log => log.userId === userId);
}

export function getUserLeaveBalance(userId: string): LeaveBalance | undefined {
  return leaveBalances.find(lb => lb.userId === userId);
}

export function getUserRequests(userId: string): LeaveRequest[] {
  return leaveRequests.filter(req => req.userId === userId);
}

export function getUserNotifications(userId: string): Notification[] {
  return notifications.filter(n => n.userId === userId);
}

export function getDepartmentEmployees(departmentId: string): User[] {
  return users.filter(u => u.departmentId === departmentId && u.role !== 'admin');
}

export function getRequestTypeAr(type: RequestType): string {
  const map: Record<RequestType, string> = {
    annual_leave: 'إجازة سنوية',
    sick_leave: 'إجازة مرضية',
    hourly_permission: 'إذن ساعي',
    time_adjustment: 'تعديل وقت',
  };
  return map[type];
}

export function getStatusAr(status: RequestStatus): string {
  const map: Record<RequestStatus, string> = {
    pending: 'قيد الانتظار',
    approved: 'موافق عليه',
    rejected: 'مرفوض',
  };
  return map[status];
}

export function getAttendanceStatusAr(status: AttendanceStatus): string {
  const map: Record<AttendanceStatus, string> = {
    present: 'حاضر',
    late: 'متأخر',
    absent: 'غائب',
    on_leave: 'في إجازة',
  };
  return map[status];
}

// Additional helper functions for user details
export function getUserAttendanceInRange(userId: string, fromDate: string, toDate: string): AttendanceLog[] {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  
  return attendanceLogs.filter(log => {
    if (log.userId !== userId) return false;
    const logDate = new Date(log.date);
    return logDate >= from && logDate <= to;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function calculateLateMinutes(checkInTime: string, workStartTime: string = '08:00', gracePeriod: number = 10): number {
  const [checkHour, checkMin] = checkInTime.split(':').map(Number);
  const [startHour, startMin] = workStartTime.split(':').map(Number);
  
  const checkMinutes = checkHour * 60 + checkMin;
  const startMinutes = startHour * 60 + startMin + gracePeriod;
  
  return Math.max(0, checkMinutes - startMinutes);
}

export function getUserMonthlyStats(userId: string, year: number, month: number) {
  const logs = attendanceLogs.filter(log => {
    if (log.userId !== userId) return false;
    const logDate = new Date(log.date);
    return logDate.getFullYear() === year && logDate.getMonth() === month;
  });

  const presentDays = logs.filter(l => l.status === 'present').length;
  const lateDays = logs.filter(l => l.status === 'late').length;
  const absentDays = logs.filter(l => l.status === 'absent').length;
  const leaveDays = logs.filter(l => l.status === 'on_leave').length;
  
  const totalLateMinutes = logs
    .filter(l => l.checkInTime && (l.status === 'late' || l.status === 'present'))
    .reduce((sum, log) => {
      const lateMin = calculateLateMinutes(log.checkInTime!);
      return sum + lateMin;
    }, 0);

  return {
    presentDays,
    lateDays,
    absentDays,
    leaveDays,
    totalLateMinutes,
    totalWorkingDays: logs.length,
  };
}

export function getTodayAttendance(userId: string): AttendanceLog | undefined {
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return attendanceLogs.find(log => log.userId === userId && log.date === dateStr);
}

export function getUserLastActivity(userId: string): { lastCheckIn?: string; lastCheckOut?: string } | null {
  const userLogs = attendanceLogs
    .filter(log => log.userId === userId && (log.checkInTime || log.checkOutTime))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  if (userLogs.length === 0) return null;
  
  const lastLog = userLogs[0];
  return {
    lastCheckIn: lastLog.checkInTime ? `${lastLog.date} ${lastLog.checkInTime}` : undefined,
    lastCheckOut: lastLog.checkOutTime ? `${lastLog.date} ${lastLog.checkOutTime}` : undefined,
  };
}

export function canAccessUserDetails(currentUser: User, targetUserId: string): boolean {
  // Admin can access all
  if (currentUser.role === 'admin') return true;
  
  // Employee can only access their own
  if (currentUser.role === 'employee') return currentUser.uid === targetUserId;
  
  // Manager can access their department employees
  if (currentUser.role === 'manager') {
    const targetUser = getUserById(targetUserId);
    if (!targetUser) return false;
    return targetUser.departmentId === currentUser.departmentId;
  }
  
  return false;
}