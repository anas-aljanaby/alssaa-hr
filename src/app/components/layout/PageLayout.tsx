import React from 'react';
import { useAppTopBar } from '../../contexts/AppTopBarContext';

interface PageLayoutProps {
  title?: string;
  /**
   * Optional primary action element rendered on the right of the header row.
   */
  action?: React.ReactNode;
  /**
   * If provided, shows a back button that navigates to this path.
   * If set to 'back', will call navigate(-1).
   */
  backPath?: string | 'back';
  children: React.ReactNode;
}

export function PageLayout({ title, action, backPath, children }: PageLayoutProps) {
  useAppTopBar(
    title || action || backPath
      ? {
          title,
          action,
          backPath,
        }
      : null
  );

  return (
    <div className="mx-auto max-w-lg space-y-3 px-4 pb-24 pt-3">
      {children}
    </div>
  );
}
