/**
 * Module purpose:
 * Renders a small attendance status dot with optional live pulse animation.
 */

import { getStatusConfig, type DisplayStatus } from '../attendance';

export interface StatusDotProps {
  status: DisplayStatus;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  className?: string;
}

export function StatusDot({
  status,
  size = 'md',
  pulse = false,
  className,
}: StatusDotProps) {
  const config = getStatusConfig(String(status));
  const sizeClasses =
    size === 'sm' ? 'h-2 w-2' : size === 'lg' ? 'h-4 w-4' : 'h-3 w-3';
  const shouldPulse = pulse && (status === 'present_now' || status === 'late_now');
  const wrapperClasses = ['relative inline-flex items-center justify-center', className]
    .filter(Boolean)
    .join(' ');
  const dotClasses = ['inline-block rounded-full', sizeClasses, config.dotColor].join(' ');

  if (!shouldPulse) {
    return <span className={[wrapperClasses, dotClasses].join(' ')} aria-hidden="true" />;
  }

  return (
    <span className={wrapperClasses} aria-hidden="true">
      <span className={['absolute animate-ping rounded-full opacity-60', sizeClasses, config.dotColor].join(' ')} />
      <span className={['relative rounded-full', sizeClasses, config.dotColor].join(' ')} />
    </span>
  );
}
