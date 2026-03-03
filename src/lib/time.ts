/**
 * Single source of "current time" for the app.
 * In production always returns real time. In dev, DevTimeProvider can override
 * so that now() returns simulated time (for testing attendance, etc.).
 */

let _nowFn: () => Date = () => new Date();

export function setNowFn(fn: () => Date): void {
  _nowFn = fn;
}

export function now(): Date {
  return _nowFn();
}
