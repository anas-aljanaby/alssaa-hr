import React from 'react';
import { Outlet } from 'react-router';
import { AuthProvider } from '../../contexts/AuthContext';
import { AppProvider } from '../../contexts/AppContext';
import { PwaProvider } from '../../contexts/PwaContext';
import { ErrorBoundary } from '../ErrorBoundary';
import { Toaster } from 'sonner';

export function RootLayout() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <PwaProvider>
          <AppProvider>
            <Outlet />
          </AppProvider>
        </PwaProvider>
        <Toaster position="top-center" richColors dir="rtl" />
      </AuthProvider>
    </ErrorBoundary>
  );
}
