import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileLayout } from './MobileLayout';

vi.mock('@/app/contexts/AuthContext', () => ({
  useAuth: () => ({
    authReady: true,
    currentUser: {
      uid: 'admin-1',
      role: 'admin',
      departmentId: 'dept-1',
    },
  }),
}));

vi.mock('@/app/contexts/PwaContext', () => ({
  usePwa: () => ({
    isOffline: true,
    updateAvailable: true,
    applyUpdate: vi.fn(),
    refreshApp: vi.fn(),
  }),
}));

vi.mock('@/lib/services/notifications.service', () => ({
  getUnreadCount: vi.fn().mockResolvedValue(2),
  subscribeToNotifications: vi.fn().mockImplementation((_uid: string, onNew: () => void) => {
    onNew();
    return () => {};
  }),
}));

vi.mock('@/lib/services/requests.service', () => ({
  getAllPendingRequests: vi.fn().mockResolvedValue([]),
  getPendingDepartmentRequests: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/app/components/notifications/NotificationsDropdown', () => ({
  NotificationsDropdown: ({ onClose }: { onClose: () => void }) => (
    <div>
      <span data-testid="notifications-dropdown">open</span>
      <button type="button" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));

vi.mock('@/app/components/notifications/DeviceNotificationsBanner', () => ({
  DeviceNotificationsBanner: () => null,
}));

describe('MobileLayout', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'scrollTo', {
      value: vi.fn(),
      writable: true,
      configurable: true,
    });
  });

  it('shows team attendance tab and toggles top notifications dropdown', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <MobileLayout />
      </MemoryRouter>
    );

    expect(screen.getByText('حضور الفريق')).toBeInTheDocument();
    expect(screen.getByText('أنت الآن في وضع عدم الاتصال.')).toBeInTheDocument();
    expect(screen.getByText('يوجد تحديث جديد للتطبيق.')).toBeInTheDocument();
    expect(screen.queryByText('الإشعارات')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('الإشعارات'));
    expect(await screen.findByTestId('notifications-dropdown')).toBeInTheDocument();
  });

  it('scrolls to top when bottom navigation changes route', async () => {
    const scrollTo = vi.mocked(window.scrollTo);

    render(
      <MemoryRouter initialEntries={['/users']}>
        <Routes>
          <Route element={<MobileLayout />}>
            <Route index element={<div data-testid="page-home">home</div>} />
            <Route path="users" element={<div data-testid="page-users">users</div>} />
            <Route path="approvals" element={<div data-testid="page-approvals">approvals</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    scrollTo.mockClear();

    fireEvent.click(screen.getByText('الموافقات'));

    expect(await screen.findByTestId('page-approvals')).toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });
});
