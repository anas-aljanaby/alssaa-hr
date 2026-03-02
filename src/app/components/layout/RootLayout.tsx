import React from 'react';
import { Outlet } from 'react-router';
import { AuthProvider } from '../../contexts/AuthContext';
import { AppProvider } from '../../contexts/AppContext';
import { DevTimeProvider } from '../../contexts/DevTimeContext';
import { ErrorBoundary } from '../ErrorBoundary';
import { Toaster } from 'sonner';
import { DevTimeToolbar } from '../dev/DevTimeToolbar';

const isDev = import.meta.env.DEV;

function MainContent() {
  return (
    <>
      <Outlet />
      {isDev && <DevTimeToolbar />}
    </>
  );
}

export function RootLayout() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        {isDev ? (
          <DevTimeProvider>
            <AppProvider>
              <MainContent />
            </AppProvider>
          </DevTimeProvider>
        ) : (
          <AppProvider>
            <MainContent />
          </AppProvider>
        )}
        <Toaster position="top-center" richColors dir="rtl" />
      </AuthProvider>
    </ErrorBoundary>
  );
}
