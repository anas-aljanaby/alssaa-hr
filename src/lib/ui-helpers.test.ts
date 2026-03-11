import { describe, it, expect, vi, afterEach } from 'vitest';
import { getStatusColor, getTimeAgoLabel } from '@/lib/ui-helpers';

// ---------------------------------------------------------------------------
// getStatusColor
// ---------------------------------------------------------------------------

describe('getStatusColor', () => {
  it.each([
    ['present', 'bg-emerald-100 text-emerald-700'],
    ['late', 'bg-amber-100 text-amber-700'],
    ['absent', 'bg-red-100 text-red-700'],
    ['on_leave', 'bg-blue-100 text-blue-700'],
  ])('returns correct classes for "%s"', (status, expected) => {
    expect(getStatusColor(status)).toBe(expected);
  });

  it('returns gray default for unknown status', () => {
    expect(getStatusColor('unknown')).toBe('bg-gray-100 text-gray-700');
  });

  it('returns gray default for empty string', () => {
    expect(getStatusColor('')).toBe('bg-gray-100 text-gray-700');
  });
});

// ---------------------------------------------------------------------------
// getTimeAgoLabel
// ---------------------------------------------------------------------------

describe('getTimeAgoLabel', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const setNow = (isoDate: string) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(isoDate));
  };

  it('shows minutes for recent timestamps', () => {
    setNow('2025-06-15T10:05:00Z');
    const result = getTimeAgoLabel('2025-06-15T10:00:00Z');
    expect(result).toBe('منذ 5 دقيقة');
  });

  it('shows 0 minutes for just now', () => {
    setNow('2025-06-15T10:00:00Z');
    const result = getTimeAgoLabel('2025-06-15T10:00:00Z');
    expect(result).toBe('منذ 0 دقيقة');
  });

  it('shows hours for 2-hour gap', () => {
    setNow('2025-06-15T12:00:00Z');
    const result = getTimeAgoLabel('2025-06-15T10:00:00Z');
    expect(result).toBe('منذ 2 ساعة');
  });

  it('shows days for 3-day gap', () => {
    setNow('2025-06-18T10:00:00Z');
    const result = getTimeAgoLabel('2025-06-15T10:00:00Z');
    expect(result).toBe('منذ 3 يوم');
  });

  it('boundary: exactly 60 minutes shows 1 hour', () => {
    setNow('2025-06-15T11:00:00Z');
    const result = getTimeAgoLabel('2025-06-15T10:00:00Z');
    expect(result).toBe('منذ 1 ساعة');
  });

  it('boundary: exactly 24 hours shows 1 day', () => {
    setNow('2025-06-16T10:00:00Z');
    const result = getTimeAgoLabel('2025-06-15T10:00:00Z');
    expect(result).toBe('منذ 1 يوم');
  });

  it('59 minutes stays in minutes', () => {
    setNow('2025-06-15T10:59:00Z');
    const result = getTimeAgoLabel('2025-06-15T10:00:00Z');
    expect(result).toBe('منذ 59 دقيقة');
  });

  it('23 hours stays in hours', () => {
    setNow('2025-06-16T09:00:00Z');
    const result = getTimeAgoLabel('2025-06-15T10:00:00Z');
    expect(result).toBe('منذ 23 ساعة');
  });
});
