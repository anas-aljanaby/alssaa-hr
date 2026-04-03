/**
 * Admin and employee UIs must only show real login emails, never phone numbers
 * (even if mis-synced into profiles.email).
 */
const EMAIL_FOR_DISPLAY = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function looksLikeEmail(value: string): boolean {
  const t = value.trim();
  return t.length > 0 && EMAIL_FOR_DISPLAY.test(t);
}

/** Read-only label for lists and headers. Non-email → em dash. */
export function displayProfileEmail(email: string | null | undefined): string {
  const t = email?.trim() ?? '';
  return looksLikeEmail(t) ? t : '—';
}

/** Edit form default: only pre-fill when the stored value is a real email. */
export function emailForFormField(email: string | null | undefined): string {
  const t = email?.trim() ?? '';
  return looksLikeEmail(t) ? t : '';
}
