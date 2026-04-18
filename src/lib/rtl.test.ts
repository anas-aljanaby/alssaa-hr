import { describe, expect, it } from 'vitest';
import { wrapRtlText } from './rtl';

describe('wrapRtlText', () => {
  it('wraps plain arabic text in an explicit RTL isolate', () => {
    expect(wrapRtlText('بدء الدوام')).toBe('\u2067بدء الدوام\u2069');
  });

  it('keeps an already isolated string unchanged', () => {
    expect(wrapRtlText('\u2067شبكة الساعة\u2069')).toBe('\u2067شبكة الساعة\u2069');
  });

  it('returns an empty string for blank input', () => {
    expect(wrapRtlText('   ')).toBe('');
  });

  it('preserves mixed-direction content inside the isolate', () => {
    expect(wrapRtlText('تم تسجيل الحضور الساعة 09:00 from test')).toBe(
      '\u2067تم تسجيل الحضور الساعة 09:00 from test\u2069'
    );
  });
});
