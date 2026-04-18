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
    });
    expect(pushMocks.subscribeToPush).not.toHaveBeenCalled();
    expect(toastMocks.success).toHaveBeenCalled();
  });

  it('does not render when permission is already granted', () => {
    pushMocks.getPushPermission.mockReturnValue('granted');

    render(<DeviceNotificationsBanner />);

    expect(screen.queryByText('فعّل إشعارات الجهاز')).not.toBeInTheDocument();
    expect(screen.queryByText('إشعارات الجهاز متوقفة')).not.toBeInTheDocument();
    expect(pushMocks.subscribeToPush).not.toHaveBeenCalled();
  });

  it('shows the denied state and rechecks permission on click', () => {
    pushMocks.getPushPermission.mockReturnValue('denied');

    render(<DeviceNotificationsBanner />);

    expect(screen.getByText('إشعارات الجهاز متوقفة')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'تحقق مجدداً' }));

    expect(pushMocks.requestAndSubscribe).not.toHaveBeenCalled();
    expect(toastMocks.error).not.toHaveBeenCalled();
  });

  it('shows an info toast when the user declines the permission prompt', async () => {
    pushMocks.requestAndSubscribe.mockResolvedValue('default');

    render(<DeviceNotificationsBanner />);

    fireEvent.click(screen.getByRole('button', { name: 'تفعيل الإشعارات' }));

    await waitFor(() => {
      expect(toastMocks.info).toHaveBeenCalled();
    });
    expect(toastMocks.error).not.toHaveBeenCalled();
  });

  it('allows dismissing the banner with the close button', () => {
    render(<DeviceNotificationsBanner />);

    fireEvent.click(screen.getByRole('button', { name: 'إغلاق تنبيه الإشعارات' }));

    expect(screen.queryByText('فعّل إشعارات الجهاز')).not.toBeInTheDocument();
  });
});
