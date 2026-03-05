import React from 'react';
import { useNavigate } from 'react-router';

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
  const navigate = useNavigate();

  const handleBack = () => {
    if (!backPath) return;
    if (backPath === 'back') {
      navigate(-1);
    } else {
      navigate(backPath);
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      {title && (
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            {backPath && (
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50"
              >
                <span className="sr-only">رجوع</span>
                <span aria-hidden="true" className="text-lg leading-none">
                  ‹
                </span>
              </button>
            )}
            <h1 className="text-gray-800 font-semibold text-lg">{title}</h1>
          </div>
          {action && <div className="ml-2">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

