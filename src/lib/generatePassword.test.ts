import { describe, expect, it, vi } from 'vitest';
import { generateStrongPassword } from './generatePassword';
import { setPasswordSchema } from './validations';

const passwordStrengthRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/;

describe('generateStrongPassword', () => {
  it('produces strings that pass app password rules', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (arr: Uint32Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 0xffffffff);
      },
    });
    for (let n = 0; n < 30; n++) {
      const pw = generateStrongPassword();
      const r = setPasswordSchema.safeParse({ password: pw, confirmPassword: pw });
      expect(r.success, pw).toBe(true);
    }
    vi.unstubAllGlobals();
  });

  it('respects length bounds', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (arr: Uint32Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 0xffffffff);
      },
    });
    expect(generateStrongPassword(4).length).toBe(8);
    expect(generateStrongPassword(200).length).toBe(128);
    expect(generateStrongPassword(12).length).toBe(12);
    vi.unstubAllGlobals();
  });

  it('always includes upper, lower, and digit', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (arr: Uint32Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 0xffffffff);
      },
    });
    for (let n = 0; n < 20; n++) {
      expect(passwordStrengthRegex.test(generateStrongPassword())).toBe(true);
    }
    vi.unstubAllGlobals();
  });
});
