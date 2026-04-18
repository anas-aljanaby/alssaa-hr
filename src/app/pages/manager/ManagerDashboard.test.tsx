import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ManagerDashboard } from './ManagerDashboard';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/lib/hooks/useRealtimeSubscription', () => ({
  useRealtimeSubscription: vi.fn(),
}));

vi.mock('@/lib/services/departments.service', () => ({
  getDepartmentById: vi.fn(),
  getDepartmentByManagerUid: vi.fn(),
}));

vi.mock('@/lib/services/profiles.service', () => ({
  getDepartmentEmployees: vi.fn(),
}));

vi.mock('@/lib/services/attendance.service', () => ({
  getDepartmentLogsForDate: vi.fn(),
  subscribeToAttendanceLogs: vi.fn(() => () => {}),
  todayStr: vi.fn(() => '2026-04-18'),
}));

vi.mock('@/lib/services/requests.service', () => ({
  getPendingDepartmentRequests: vi.fn(),
  subscribeToAllRequests: vi.fn(() => () => {}),
}));

vi.mock('../../hooks/useTodayPunch', () => ({
  useTodayPunch: vi.fn(() => ({
    loading: true,
    today: null,
    actionLoading: false,
    handleCheckIn: vi.fn(),
    handleCheckOut: vi.fn(),
  })),
}));

vi.mock('../../contexts/PwaContext', () => ({
  usePwa: vi.fn(() => ({ isOffline: false })),
}));

vi.mock('@/lib/services/publishing-tag.service', () => ({
  getPublishingTagHolder: vi.fn(),
  claimPublishingTag: vi.fn(),
  releasePublishingTag: vi.fn(),
  forceReleasePublishingTag: vi.fn(),
}));

const authContext = await import('../../contexts/AuthContext');
const departmentsService = await import('@/lib/services/departments.service');
const profilesService = await import('@/lib/services/profiles.service');
const attendanceService = await import('@/lib/services/attendance.service');
const requestsService = await import('@/lib/services/requests.service');
const publishingTagService = await import('@/lib/services/publishing-tag.service');

describe('ManagerDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(authContext.useAuth).mockReturnValue({
      currentUser: {
        uid: 'manager-1',
        orgId: 'org-1',
        nameAr: 'سارة',
        role: 'manager',
        departmentId: 'dept-1',
      },
    } as any);

    vi.mocked(departmentsService.getDepartmentById).mockResolvedValue({
      id: 'dept-1',
      org_id: 'org-1',
      name_ar: 'الأخبار',
    } as any);
    vi.mocked(profilesService.getDepartmentEmployees).mockResolvedValue([
      {
        id: 'emp-1',
        org_id: 'org-1',
        employee_id: 'EMP-001',
        name_ar: 'علي',
        role: 'employee',
        department_id: 'dept-1',
        join_date: '2024-01-01',
      },
    ] as any);
    vi.mocked(attendanceService.getDepartmentLogsForDate).mockResolvedValue([]);
    vi.mocked(requestsService.getPendingDepartmentRequests).mockResolvedValue([]);
    vi.mocked(publishingTagService.getPublishingTagHolder).mockResolvedValue({
      id: 'tag-1',
      org_id: 'org-1',
      user_id: 'manager-1',
      claimed_at: '2026-04-18T08:00:00.000Z',
      released_at: null,
      force_released_by: null,
      force_released_at: null,
      claim_status: 'claimed',
      holder_profile: {
        id: 'manager-1',
        name_ar: 'سارة',
        avatar_url: null,
        department: { name_ar: 'الموارد البشرية' },
      },
      force_released_by_profile: null,
    } as any);
  });

  it('shows the publishing tag card with employee actions for managers', async () => {
    render(
      <MemoryRouter>
        <ManagerDashboard />
      </MemoryRouter>
    );

    await screen.findByText('وسم الناشر');
    expect(screen.getByText('القسم الحالي: الموارد البشرية')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'التنازل عن الوسم' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'إلغاء الوسم' })).not.toBeInTheDocument();
  });
});
