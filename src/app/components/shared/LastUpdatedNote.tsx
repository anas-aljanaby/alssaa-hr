import { CloudOff, Clock3 } from 'lucide-react';

interface LastUpdatedNoteProps {
  /** Timestamp of the last successful data fetch, or null while still loading. */
  lastUpdatedAt: Date | null;
  /** True when the currently shown data was served from the local cache. */
  fromCache?: boolean;
  /** Show even when data is fresh/online. Defaults to offline-only. */
  alwaysShow?: boolean;
  className?: string;
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'الآن';
  if (diffMin < 60) return `قبل ${diffMin} د`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `قبل ${diffHr} س`;
  return date.toLocaleDateString('ar-IQ');
}

/**
 * Small, unobtrusive "last updated at ..." indicator used on cached screens so
 * the user knows whether the numbers on the page are current or the last
 * version downloaded before going offline.
 */
export function LastUpdatedNote({
  lastUpdatedAt,
  fromCache = false,
  alwaysShow = false,
  className,
}: LastUpdatedNoteProps) {
  if (!lastUpdatedAt) return null;
  if (!fromCache && !alwaysShow) return null;

  const Icon = fromCache ? CloudOff : Clock3;
  const label = fromCache
    ? `بيانات محفوظة محلياً — آخر تحديث ${formatRelative(lastUpdatedAt)}`
    : `آخر تحديث ${formatRelative(lastUpdatedAt)}`;

  return (
    <div
      className={
        'flex items-center gap-1.5 text-[11px] text-gray-400 ' + (className ?? '')
      }
      role="status"
      aria-live="polite"
    >
      <Icon className="h-3 w-3" />
      <span>{label}</span>
    </div>
  );
}
