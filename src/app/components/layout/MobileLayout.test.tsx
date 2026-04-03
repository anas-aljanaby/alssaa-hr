import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
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

describe('MobileLayout', () => {
  it('shows departments tab and toggles top notifications dropdown', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <MobileLayout />
      </MemoryRouter>
    );

    expect(screen.getByText('الأقسام')).toBeInTheDocument();
    expect(screen.queryByText('الإشعارات')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('الإشعارات'));
    expect(await screen.findByTestId('notifications-dropdown')).toBeInTheDocument();
  });
});
