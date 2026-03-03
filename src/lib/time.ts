let _nowFn: () => Date = () => new Date();

export function setNowFn(fn: () => Date): void {
  _nowFn = fn;
}

export function now(): Date {
  return _nowFn();
}
