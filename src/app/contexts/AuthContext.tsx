import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { User, UserRole } from '../data/mockData';
import { users as mockUsers } from '../data/mockData';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  authReady: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string, name: string) => Promise<{ ok: boolean; error?: string }>;
  loginAs: (role: UserRole) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_USERS: Record<UserRole, User> = {
  admin: mockUsers.find(u => u.role === 'admin')!,
  manager: mockUsers.find(u => u.role === 'manager')!,
  employee: mockUsers.find(u => u.role === 'employee')!,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const login = useCallback(async (email: string, _password: string): Promise<boolean> => {
    const found = mockUsers.find(u => u.email === email);
    if (found) {
      setCurrentUser(found);
      return true;
    }
    return false;
  }, []);

  const signUp = useCallback(
    async (
      email: string,
      _password: string,
      name: string
    ): Promise<{ ok: boolean; error?: string }> => {
      const newUser: User = {
        uid: `user-${Date.now()}`,
        employeeId: `EMP-${Date.now()}`,
        name,
        nameAr: name,
        email,
        phone: '',
        role: 'employee',
        departmentId: '',
        status: 'active',
        joinDate: new Date().toISOString(),
      };
      setCurrentUser(newUser);
      return { ok: true };
    },
    []
  );

  const loginAs = useCallback((role: UserRole) => {
    setCurrentUser(DEMO_USERS[role]);
  }, []);

  const logout = useCallback(async () => {
    setCurrentUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        authReady: true,
        login,
        signUp,
        loginAs,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
