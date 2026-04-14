import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeviceNotificationsBanner } from './DeviceNotificationsBanner';

const authState = vi.hoisted(() => ({
  currentUser: { uid: 'user-1' },
}));

const pwaState = vi.hoisted(() => ({
  isOffline: false,
}));

const pushMocks = vi.hoisted(() => ({
  getPushPermission: vi.fn(),
  isPushSupported: vi.fn(),
  requestAndSubscribe: vi.fn(),
  subscribeToPush: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/app/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('@/app/contexts/PwaContext', () => ({
  usePwa: () => pwaState,
}));

vi.mock('@/lib/push/push-manager', () => pushMocks);

vi.mock('sonner', () => ({
  toast: toastMocks,
}));

describe('DeviceNotificationsBanner', () => {
  beforeEach(() => {
    authState.currentUser = { uid: 'user-1' };
    pwaState.isOffline = false;
    pushMocks.isPushSupported.mockReturnValue(true);
    pushMocks.getPushPermission.mockReturnValue('default');
    pushMocks.requestAndSubscribe.mockResolvedValue('granted');
    pushMocks.subscribeToPush.mockResolvedValue(true);
    toastMocks.success.mockReset();
    toastMocks.info.mockReset();
    toastMocks.error.mockReset();
    pushMocks.isPushSupported.mockClear();
    pushMocks.getPushPermission.mockClear();
    pushMocks.requestAndSubscribe.mockClear();
    pushMocks.subscribeToPush.mockClear();
  });

  it('prompts the user to enable push and subscribes the device on click', async () => {
    render(<DeviceNotificationsBanner />);

    expect(screen.getByText('فعّل إشعارات الجهاز')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'تفعيل الإشعارات' }));

    await waitFor(() => {
      expect(pushMocks.requestAndSubscribe).toHaveBeenCalledWith('user-1');
      expect(pushMocks.subscribeToPush).toHaveBeenCalledWith('user-1');
    });
    expect(toastMocks.success).toHaveBeenCalled();
  });

  it('silently syncs the existing subscription when permission is already granted', async () => {
    pushMocks.getPushPermission.mockReturnValue('granted');

    render(<DeviceNotificationsBanner />);

    await waitFor(() => {
      expect(pushMocks.subscribeToPush).toHaveBeenCalledWith('user-1');
    });
    expect(screen.queryByText('فعّل إشعارات الجهاز')).not.toBeInTheDocument();
  });

  it('shows a retry state when permission is granted but subscription storage fails', async () => {
    pushMocks.getPushPermission.mockReturnValue('granted');
    pushMocks.subscribeToPush.mockResolvedValue(false);

    render(<DeviceNotificationsBanner />);

    await waitFor(() => {
      expect(screen.getByText('تعذر ربط هذا الجهاز بإشعارات الدوام')).toBeInTheDocument();
    });
  });
});
