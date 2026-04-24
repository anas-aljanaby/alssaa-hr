export function getStatusColor(status: string): string {
  switch (status) {
    case 'present':
      return 'bg-emerald-100 text-emerald-700';
    case 'late':
      return 'bg-amber-100 text-amber-700';
    case 'absent':
      return 'bg-red-100 text-red-700';
    case 'on_leave':
      return 'bg-blue-100 text-blue-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

export function getTimeAgoLabel(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  if (hours < 24) return `منذ ${hours} ساعة`;
  return `منذ ${days} يوم`;
}

/**
 * Copies text to the clipboard. Tries the Async Clipboard API first, then a
 * temporary textarea + execCommand fallback (needed on some desktop browsers
 * when the page is not a secure context or clipboard permission is denied).
 */
export async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof document === 'undefined') {
    throw new Error('clipboard unavailable');
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to legacy copy (common on http:// LAN dev URLs, strict policies, etc.)
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.setAttribute('tabindex', '-1');
  textarea.setAttribute('aria-hidden', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '0';
  textarea.style.top = '0';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  textarea.style.width = '1px';
  textarea.style.height = '1px';
  textarea.dir = 'ltr';

  document.body.appendChild(textarea);
  textarea.focus();

  const selection = document.getSelection();
  if (selection) {
    selection.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(textarea);
    selection.addRange(range);
  }
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  let ok = false;
  try {
    ok = document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
    selection?.removeAllRanges();
  }

  if (!ok) {
    throw new Error('copy failed');
  }
}
