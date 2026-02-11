import React from 'react';
import { Outlet } from 'react-router';
import { AuthProvider } from '../../contexts/AuthContext';
import { AppProvider } from '../../contexts/AppContext';
import { Toaster } from 'sonner';

export function RootLayout() {
  return (
    <AuthProvider>
      <AppProvider>
        <Outlet />
        <Toaster position="top-center" richColors dir="rtl" />
      </AppProvider>
    </AuthProvider>
  );
}
