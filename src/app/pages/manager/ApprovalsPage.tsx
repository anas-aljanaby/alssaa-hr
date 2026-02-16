import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { toast } from 'sonner';
import * as profilesService from '@/lib/services/profiles.service';
import * as requestsService from '@/lib/services/requests.service';
import { useRealtimeSubscription } from '@/lib/hooks/useRealtimeSubscription';
import { getRequestTypeAr, getStatusAr } from '../../data/mockData';
import type { Profile } from '@/lib/services/profiles.service';
import type { LeaveRequest } from '@/lib/services/requests.service';
import {
  CheckCircle2,
  XCircle,
  Timer,
  Calendar,
  MessageSquare,
  X,
  FileText,
} from 'lucide-react';

export function ApprovalsPage() {
  const { currentUser } = useAuth();
  const { updateRequestStatus } = useApp();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [actionModal, setActionModal] = useState<{
    requestId: string;
    action: 'approve' | 'reject';
  } | null>(null);
  const [comment, setComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const employeeIds = useMemo(() => new Set(employees.map((e) => e.id)), [employees]);

  useEffect(() => {
    if (!currentUser) return;
    loadData();
  }, [currentUser?.uid]);

  useRealtimeSubscription(
    () => {
      if (!currentUser || employees.length === 0) return undefined;
      return requestsService.subscribeToAllRequests((event) => {
        if (!employeeIds.has(event.new.user_id)) return;
        if (event.eventType === 'INSERT') {
          setRequests((prev) => [event.new, ...prev]);
        } else if (event.eventType === 'UPDATE') {
          setRequests((prev) =>
            prev.map((r) => (r.id === event.new.id ? event.new : r))
          );
        }
      });
    },
    [currentUser?.uid, employees.length, employeeIds]
  );

  async function loadData() {
    if (!currentUser?.departmentId) return;
    try {
      setLoading(true);
      const [emps, reqs] = await Promise.all([
        profilesService.getDepartmentEmployees(currentUser.departmentId),
        requestsService.getDepartmentRequests(currentUser.departmentId),
      ]);
      setEmployees(emps);
      setRequests(reqs);
    } catch {
      toast.error('فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }

  const profilesMap = useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [employees]
  );

  if (!currentUser) return null;

  const filteredRequests = requests
    .filter((r) => filter === 'all' || r.status === filter)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  const handleAction = async () => {
    if (!actionModal) return;
    setActionLoading(true);
    try {
      const status = actionModal.action === 'approve' ? 'approved' : 'rejected';
      await updateRequestStatus(actionModal.requestId, status, currentUser.uid, comment);
      setActionModal(null);
      setComment('');
      await loadData();
    } catch {
      /* toast handled by context */
    } finally {
      setActionLoading(false);
    }
  };

  const filterTabs = [
    { value: 'pending' as const, label: 'قيد الانتظار', count: pendingCount },
    { value: 'approved' as const, label: 'موافق عليها' },
    { value: 'rejected' as const, label: 'مرفوضة' },
    { value: 'all' as const, label: 'الكل' },
  ];

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h1 className="text-gray-800">الموافقات</h1>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              filter === tab.value
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                  filter === tab.value ? 'bg-white/20' : 'bg-amber-100 text-amber-600'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-40 animate-pulse" />
          ))}
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>لا توجد طلبات</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((req) => {
            const user = profilesMap.get(req.user_id);
            return (
              <div key={req.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-sm text-blue-600">
                        {user?.name_ar?.charAt(0) ?? '?'}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-800">{user?.name_ar ?? '—'}</p>
                      <p className="text-xs text-gray-500">{user?.employee_id}</p>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs ${
                      req.status === 'pending'
                        ? 'bg-amber-100 text-amber-700'
                        : req.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {getStatusAr(req.status)}
                  </span>
                </div>

                <div className="bg-gray-50 rounded-xl p-3 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-blue-600">{getRequestTypeAr(req.type)}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        من: {new Date(req.from_date_time).toLocaleDateString('ar-IQ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        إلى: {new Date(req.to_date_time).toLocaleDateString('ar-IQ')}
                      </span>
                    </div>
                  </div>
                  {req.note && (
                    <p className="text-sm text-gray-600 mt-2 pt-2 border-t border-gray-200">
                      {req.note}
                    </p>
                  )}
                </div>

                {req.decision_note && (
                  <div
                    className={`text-sm p-2.5 rounded-xl mb-3 ${
                      req.status === 'approved'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-red-50 text-red-700'
                    }`}
                  >
                    <div className="flex items-center gap-1 mb-1">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span className="text-xs opacity-70">ملاحظة القرار:</span>
                    </div>
                    {req.decision_note}
                  </div>
                )}

                {req.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setActionModal({ requestId: req.id, action: 'approve' })
                      }
                      className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      موافقة
                    </button>
                    <button
                      onClick={() =>
                        setActionModal({ requestId: req.id, action: 'reject' })
                      }
                      className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      رفض
                    </button>
                  </div>
                )}

                <div className="text-xs text-gray-400 mt-2">
                  تم الإنشاء:{' '}
                  {new Date(req.created_at).toLocaleDateString('ar-IQ', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {actionModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end z-50"
          onClick={() => setActionModal(null)}
        >
          <div
            className="bg-white rounded-t-3xl w-full max-w-lg mx-auto p-6"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-gray-800">
                {actionModal.action === 'approve' ? 'تأكيد الموافقة' : 'تأكيد الرفض'}
              </h2>
              <button
                onClick={() => setActionModal(null)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="mb-4">
              <label className="block mb-1.5 text-gray-700">ملاحظات القرار</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="اكتب ملاحظاتك..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAction}
                disabled={actionLoading}
                className={`flex-1 py-3 text-white rounded-xl transition-colors disabled:opacity-50 ${
                  actionModal.action === 'approve'
                    ? 'bg-emerald-500 hover:bg-emerald-600'
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {actionLoading
                  ? 'جاري التحديث...'
                  : actionModal.action === 'approve'
                    ? 'تأكيد الموافقة'
                    : 'تأكيد الرفض'}
              </button>
              <button
                onClick={() => setActionModal(null)}
                className="px-6 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
