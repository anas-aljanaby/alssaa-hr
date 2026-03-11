import { describe, it, expect, afterEach } from 'vitest';
import { now, setNowFn } from '@/lib/time';

describe('time', () => {
  afterEach(() => {
    setNowFn(() => new Date());
  });

  describe('now()', () => {
    it('returns a Date close to real time by default', () => {
      const before = Date.now();
      const result = now();
      const after = Date.now();

      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.getTime()).toBeLessThanOrEqual(after);
    });

    it('returns the overridden date after setNowFn', () => {
      const fixed = new Date('2025-06-15T10:00:00Z');
      setNowFn(() => fixed);

      expect(now()).toBe(fixed);
      expect(now().toISOString()).toBe('2025-06-15T10:00:00.000Z');
    });

    it('returns the same value on repeated calls with a fixed fn', () => {
      const fixed = new Date('2024-01-01T00:00:00Z');
      setNowFn(() => fixed);

      const a = now();
      const b = now();
      expect(a).toBe(b);
      expect(a.getTime()).toBe(b.getTime());
    });
  });

  describe('setNowFn()', () => {
    it('restores real-time behavior when reset', () => {
      setNowFn(() => new Date('2000-01-01T00:00:00Z'));
      expect(now().getFullYear()).toBe(2000);

      setNowFn(() => new Date());
      const year = now().getFullYear();
      expect(year).toBeGreaterThanOrEqual(2025);
    });

    it('supports a dynamic fn that advances on each call', () => {
      let counter = 0;
      setNowFn(() => new Date(2025, 0, 1, 0, 0, counter++));

      const first = now().getSeconds();
      const second = now().getSeconds();
      expect(second).toBe(first + 1);
    });
  });
});
