/**
 * Module purpose:
 * Renders a reusable attendance status pill using the shared display config.
 */

import { getStatusConfig, isDisplayStatus, type DisplayStatus } from '../attendance';

export interface StatusBadgeProps {
  status: DisplayStatus;
  size?: 'sm' | 'md';
  className?: string;
}

export function StatusBadge({
  status,
  size = 'md',
  className,
}: StatusBadgeProps) {
  const statusKey = String(status);
  const config = getStatusConfig(statusKey);
  const label = isDisplayStatus(statusKey) ? config.label : statusKey;
  const sizeClasses =
    size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1';

  const classes = [
    'inline-flex items-center rounded-full border font-medium',
    sizeClasses,
    config.bgColor,
    config.color,
    config.borderColor,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <span className={classes}>{label}</span>;
}
