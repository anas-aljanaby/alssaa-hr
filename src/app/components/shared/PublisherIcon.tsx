import { Megaphone } from 'lucide-react';
import { cn } from '@/app/components/ui/utils';

interface PublisherIconProps {
  className?: string;
  size?: number;
}

/**
 * Universal icon that denotes "the current publisher" across the app.
 * Use this anywhere you want to indicate publishing status without
 * requiring the full PublishingTagCard.
 */
export function PublisherIcon({ className, size = 16 }: PublisherIconProps) {
  return (
    <Megaphone
      className={cn('text-blue-600', className)}
      style={{ width: size, height: size }}
    />
  );
}
