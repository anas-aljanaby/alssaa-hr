const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const ALPHANUM = LOWER + UPPER + DIGITS;

const DEFAULT_LENGTH = 16;
const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

/** Unbiased index in [0, max) using crypto.getRandomValues */
function randomIndex(max: number): number {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0]!;
  } while (x >= limit);
  return x % max;
}

function pickChar(pool: string): string {
  return pool[randomIndex(pool.length)]!;
}

/**
 * Random password satisfying app rules: 8–128 chars, at least one lower, upper, and digit.
 * No special characters required by validation.
 */
export function generateStrongPassword(length: number = DEFAULT_LENGTH): string {
  const len = Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, Math.floor(length)));
  const chars: string[] = [pickChar(LOWER), pickChar(UPPER), pickChar(DIGITS)];
  for (let i = 3; i < len; i++) {
    chars.push(pickChar(ALPHANUM));
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
}
