import React from 'react';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProvider, useApp } from './AppContext';

const toastError = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const checkIn = vi.fn();
const markAsRead = vi.fn();

vi.mock('@/lib/services/attendance.service', () => ({
  checkIn: (...args: unknown[]) => checkIn(...args),
}));

vi.mock('@/lib/services/requests.service', () => ({
  submitRequest: vi.fn(),
  updateRequestStatus: vi.fn(),
}));

vi.mock('@/lib/services/overtime-requests.service', () => ({
  updateOvertimeRequestStatus: vi.fn(),
}));

vi.mock('@/lib/services/notifications.service', () => ({
  markAsRead: (...args: unknown[]) => markAsRead(...args),
  markAllAsRead: vi.fn(),
}));

vi.mock('./PwaContext', () => ({
  usePwa: () => ({
    isOffline: true,
  }),
}));

describe('AppContext', () => {
  beforeEach(() => {
    checkIn.mockReset();
    markAsRead.mockReset();
    toastError.mockReset();
  });

  it('blocks check-in while offline before hitting the service layer', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AppProvider>{children}</AppProvider>
    );

    const { result } = renderHook(() => useApp(), { wrapper });

    await expect(result.current.checkIn('user-1')).rejects.toThrow('الاتصال بالإنترنت مطلوب');
    expect(checkIn).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalled();
  });

  it('blocks notification mutations while offline before hitting the service layer', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AppProvider>{children}</AppProvider>
    );

    const { result } = renderHook(() => useApp(), { wrapper });

    await expect(result.current.markNotificationRead('notif-1')).rejects.toThrow('الاتصال بالإنترنت مطلوب');
    expect(markAsRead).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalled();
  });
});

