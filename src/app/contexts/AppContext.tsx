import React, { createContext, useContext, type ReactNode } from 'react';
import { toast } from 'sonner';
import * as attendanceService from '@/lib/services/attendance.service';
import * as requestsService from '@/lib/services/requests.service';
import * as notificationsService from '@/lib/services/notifications.service';

type AttendanceLog = attendanceService.AttendanceLog;
type LeaveRequest = requestsService.LeaveRequest;
type LeaveRequestInsert = requestsService.LeaveRequestInsert;

interface AppContextType {
  checkIn: (userId: string, coords?: { lat: number; lng: number }) => Promise<AttendanceLog>;
  checkOut: (userId: string, coords?: { lat: number; lng: number }) => Promise<AttendanceLog>;
  submitRequest: (request: Omit<LeaveRequestInsert, 'id' | 'status' | 'created_at'>) => Promise<LeaveRequest>;
  updateRequestStatus: (requestId: string, status: 'approved' | 'rejected', approverId: string, note: string) => Promise<LeaveRequest>;
  markNotificationRead: (notifId: string) => Promise<void>;
  markAllNotificationsRead: (userId: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const checkIn = async (userId: string, coords?: { lat: number; lng: number }): Promise<AttendanceLog> => {
    try {
      const result = await attendanceService.checkIn(userId, coords);
      toast.success('تم تسجيل الحضور بنجاح');
      return result;
    } catch (err: any) {
      toast.error(err.message || 'فشل تسجيل الحضور');
      throw err;
    }
  };

  const checkOut = async (userId: string, coords?: { lat: number; lng: number }): Promise<AttendanceLog> => {
    try {
      const result = await attendanceService.checkOut(userId, coords);
      toast.success('تم تسجيل الانصراف بنجاح');
      return result;
    } catch (err: any) {
      toast.error(err.message || 'فشل تسجيل الانصراف');
      throw err;
    }
  };

  const submitRequest = async (
    request: Omit<LeaveRequestInsert, 'id' | 'status' | 'created_at'>
  ): Promise<LeaveRequest> => {
    try {
      const result = await requestsService.submitRequest(request);
      toast.success('تم إرسال الطلب بنجاح');
      return result;
    } catch (err: any) {
      toast.error(err.message || 'فشل إرسال الطلب');
      throw err;
    }
  };

  const updateRequestStatus = async (
    requestId: string,
    status: 'approved' | 'rejected',
    approverId: string,
    note: string
  ): Promise<LeaveRequest> => {
    try {
      const result = await requestsService.updateRequestStatus(requestId, status, approverId, note);
      toast.success(status === 'approved' ? 'تمت الموافقة على الطلب' : 'تم رفض الطلب');
      return result;
    } catch (err: any) {
      toast.error(err.message || 'فشل تحديث الطلب');
      throw err;
    }
  };

  const markNotificationRead = async (notifId: string): Promise<void> => {
    try {
      await notificationsService.markAsRead(notifId);
    } catch {
      toast.error('فشل تحديث الإشعار');
    }
  };

  const markAllNotificationsRead = async (userId: string): Promise<void> => {
    try {
      await notificationsService.markAllAsRead(userId);
    } catch {
      toast.error('فشل تحديث الإشعارات');
    }
  };

  return (
    <AppContext.Provider
      value={{
        checkIn,
        checkOut,
        submitRequest,
        updateRequestStatus,
        markNotificationRead,
        markAllNotificationsRead,
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
