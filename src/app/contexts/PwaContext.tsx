import React, { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import {
  applyPwaUpdate,
  canPromptInstall,
  getPwaSnapshot,
  initializePwa,
  isIosInstallHintAvailable,
  promptInstall,
  refreshPwaApp,
  subscribeToPwaState,
} from '@/app/pwa/runtime';

type PwaContextValue = ReturnType<typeof usePwaValue>;

const PwaContext = createContext<PwaContextValue | undefined>(undefined);

function usePwaValue() {
  const snapshot = useSyncExternalStore(subscribeToPwaState, getPwaSnapshot, getPwaSnapshot);

  return useMemo(
    () => ({
      ...snapshot,
      install: async () => {
        if (canPromptInstall()) {
          const installed = await promptInstall();
          if (!installed) {
            toast.info('يمكنك تثبيت التطبيق لاحقاً من المتصفح متى أردت.');
          }
          return installed;
        }

        if (isIosInstallHintAvailable()) {
          toast.message('أضف التطبيق إلى الشاشة الرئيسية من Safari.', {
            description: 'افتح قائمة المشاركة ثم اختر "إضافة إلى الشاشة الرئيسية".',
          });
          return false;
        }

        toast.info('خيار التثبيت غير متاح الآن على هذا المتصفح.');
        return false;
      },
      applyUpdate: async () => {
        await applyPwaUpdate();
      },
      refreshApp: () => {
        refreshPwaApp();
      },
    }),
    [snapshot]
  );
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initializePwa();
  }, []);
  const value = usePwaValue();
  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

export function usePwa() {
  const context = useContext(PwaContext);
  if (!context) {
    throw new Error('usePwa must be used within a PwaProvider');
  }
  return context;
}
