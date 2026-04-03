import { describe, it, expect } from 'vitest';
import { displayProfileEmail, emailForFormField, looksLikeEmail } from './profileDisplay';

describe('profileDisplay', () => {
  it('looksLikeEmail accepts normal addresses', () => {
    expect(looksLikeEmail('a@b.co')).toBe(true);
    expect(looksLikeEmail('  user@example.com  ')).toBe(true);
  });

  it('looksLikeEmail rejects phone-like and empty values', () => {
    expect(looksLikeEmail('')).toBe(false);
    expect(looksLikeEmail('+964 770 000 0000')).toBe(false);
    expect(looksLikeEmail('9647700000000')).toBe(false);
    expect(looksLikeEmail('not-an-email')).toBe(false);
    expect(looksLikeEmail('nodot@localhost')).toBe(false);
  });

  it('displayProfileEmail shows em dash for non-email', () => {
    expect(displayProfileEmail('+1 234')).toBe('—');
    expect(displayProfileEmail(null)).toBe('—');
    expect(displayProfileEmail('ok@example.com')).toBe('ok@example.com');
  });

  it('emailForFormField clears non-email', () => {
    expect(emailForFormField('+964 770')).toBe('');
    expect(emailForFormField('x@y.z')).toBe('x@y.z');
  });
});
