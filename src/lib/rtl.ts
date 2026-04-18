const RTL_ISOLATE_START = '\u2067';
const RTL_ISOLATE_END = '\u2069';

export function wrapRtlText(value: string | null | undefined): string {
  if (typeof value !== 'string') return '';

  const trimmed = value.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith(RTL_ISOLATE_START) && trimmed.endsWith(RTL_ISOLATE_END)) {
    return trimmed;
  }

  return `${RTL_ISOLATE_START}${trimmed}${RTL_ISOLATE_END}`;
}
