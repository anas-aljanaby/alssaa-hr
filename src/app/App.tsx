import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';

export default function App() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return (
    <>
      {isOffline && (
        <div className="fixed top-3 start-1/2 z-50 -translate-x-1/2 rounded-lg bg-amber-500 px-3 py-2 text-sm text-white shadow-lg">
          أنت غير متصل بالإنترنت الآن. يمكن تصفح الصفحات المخزنة مؤقتاً.
        </div>
      )}
      <RouterProvider router={router} />
    </>
  );
}
