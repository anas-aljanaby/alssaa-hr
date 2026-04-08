import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

export interface AppTopBarConfig {
  title?: string;
  meta?: React.ReactNode;
  backPath?: string | 'back';
  action?: React.ReactNode;
}

type OwnedTopBarConfig = AppTopBarConfig & {
  owner: symbol;
};

type AppTopBarContextValue = {
  topBar: OwnedTopBarConfig | null;
  setTopBar: React.Dispatch<React.SetStateAction<OwnedTopBarConfig | null>>;
};

const AppTopBarContext = createContext<AppTopBarContextValue | null>(null);

export function AppTopBarProvider({ children }: { children: React.ReactNode }) {
  const [topBar, setTopBar] = useState<OwnedTopBarConfig | null>(null);
  const value = useMemo(() => ({ topBar, setTopBar }), [topBar]);

  return <AppTopBarContext.Provider value={value}>{children}</AppTopBarContext.Provider>;
}

export function useAppTopBarState() {
  const context = useContext(AppTopBarContext);
  if (!context) {
    throw new Error('useAppTopBarState must be used within AppTopBarProvider');
  }
  return context;
}

export function useAppTopBar(config: AppTopBarConfig | null) {
  const context = useContext(AppTopBarContext);
  const ownerRef = useRef<symbol | null>(null);
  const title = config?.title;
  const meta = config?.meta;
  const backPath = config?.backPath;
  const action = config?.action;

  if (!ownerRef.current) {
    ownerRef.current = Symbol('app-top-bar');
  }

  useEffect(() => {
    if (!context) return;

    const { setTopBar } = context;
    const owner = ownerRef.current!;

    if (config == null) {
      setTopBar((current) => (current?.owner === owner ? null : current));
      return;
    }

    setTopBar((current) => {
      if (
        current?.owner === owner &&
        current.title === title &&
        current.meta === meta &&
        current.backPath === backPath &&
        current.action === action
      ) {
        return current;
      }

      return {
        title,
        meta,
        backPath,
        action,
        owner,
      };
    });

    return () => {
      setTopBar((current) => (current?.owner === owner ? null : current));
    };
  }, [action, backPath, context, meta, title]);
}
