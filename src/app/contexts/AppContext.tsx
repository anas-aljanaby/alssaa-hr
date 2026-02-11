import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import {
  type AttendanceLog,
  type LeaveRequest,
  type Notification,
  type RequestStatus,
  attendanceLogs as initialAttendanceLogs,
  leaveRequests as initialRequests,
  notifications as initialNotifications,
} from '../data/mockData';

interface AppContextType {
  attendanceLogs: AttendanceLog[];
  requests: LeaveRequest[];
  notifications: Notification[];
  checkIn: (userId: string) => void;
  checkOut: (userId: string) => void;
  getTodayLog: (userId: string) => AttendanceLog | undefined;
  submitRequest: (request: Omit<LeaveRequest, 'id' | 'status' | 'createdAt'>) => void;
  updateRequestStatus: (requestId: string, status: RequestStatus, approverId: string, note: string) => void;
  markNotificationRead: (notifId: string) => void;
  getUnreadCount: (userId: string) => number;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>(initialAttendanceLogs);
  const [requests, setRequests] = useState<LeaveRequest[]>(initialRequests);
  const [notifs, setNotifs] = useState<Notification[]>(initialNotifications);

  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getTodayLog = useCallback((userId: string): AttendanceLog | undefined => {
    const today = getTodayStr();
    return attendanceLogs.find(log => log.userId === userId && log.date === today);
  }, [attendanceLogs]);

  const checkIn = useCallback((userId: string) => {
    const today = getTodayStr();
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const existing = attendanceLogs.find(log => log.userId === userId && log.date === today);
    if (existing && existing.checkInTime) return; // Already checked in

    const isLate = now.getHours() > 8 || (now.getHours() === 8 && now.getMinutes() > 10);

    const newLog: AttendanceLog = {
      id: `att-${userId}-${today}`,
      userId,
      date: today,
      checkInTime: timeStr,
      checkOutTime: null,
      status: isLate ? 'late' : 'present',
      checkInLocation: { lat: 33.3152, lng: 44.3661 },
    };

    setAttendanceLogs(prev => {
      const filtered = prev.filter(log => !(log.userId === userId && log.date === today));
      return [...filtered, newLog];
    });
  }, [attendanceLogs]);

  const checkOut = useCallback((userId: string) => {
    const today = getTodayStr();
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    setAttendanceLogs(prev =>
      prev.map(log => {
        if (log.userId === userId && log.date === today && log.checkInTime && !log.checkOutTime) {
          return { ...log, checkOutTime: timeStr, checkOutLocation: { lat: 33.3152, lng: 44.3661 } };
        }
        return log;
      })
    );
  }, []);

  const submitRequest = useCallback((request: Omit<LeaveRequest, 'id' | 'status' | 'createdAt'>) => {
    const newReq: LeaveRequest = {
      ...request,
      id: `req-${Date.now()}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    setRequests(prev => [newReq, ...prev]);
  }, []);

  const updateRequestStatus = useCallback((requestId: string, status: RequestStatus, approverId: string, note: string) => {
    setRequests(prev =>
      prev.map(req => {
        if (req.id === requestId) {
          return { ...req, status, approverId, decisionNote: note };
        }
        return req;
      })
    );
  }, []);

  const markNotificationRead = useCallback((notifId: string) => {
    setNotifs(prev =>
      prev.map(n => (n.id === notifId ? { ...n, readStatus: true } : n))
    );
  }, []);

  const getUnreadCount = useCallback((userId: string) => {
    return notifs.filter(n => n.userId === userId && !n.readStatus).length;
  }, [notifs]);

  return (
    <AppContext.Provider
      value={{
        attendanceLogs,
        requests,
        notifications: notifs,
        checkIn,
        checkOut,
        getTodayLog,
        submitRequest,
        updateRequestStatus,
        markNotificationRead,
        getUnreadCount,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
