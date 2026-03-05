import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { approvalSchema, type ApprovalFormData } from '@/lib/validations';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { toast } from 'sonner';
import * as profilesService from '@/lib/services/profiles.service';
import * as requestsService from '@/lib/services/requests.service';
import { useRealtimeSubscription } from '@/lib/hooks/useRealtimeSubscription';
import { getRequestTypeAr, getStatusAr } from '../../data/mockData';
import type { Profile } from '@/lib/services/profiles.service';
import type { LeaveRequest } from '@/lib/services/requests.service';
import { Pagination, usePagination } from '../../components/Pagination';
import { ListPageSkeleton } from '../../components/skeletons';
import {
  CheckCircle2,
  XCircle,
  Timer,
  Calendar,
  MessageSquare,
  X,
  FileText,
} from 'lucide-react';
import { PageLayout } from '../../components/layout/PageLayout';
import { FilterChips } from '../../components/shared/FilterChips';
import { RequestCard } from '../../components/shared/RequestCard';
import { EmptyState } from '../../components/shared/EmptyState';

const PAGE_SIZE = 10;

export function ApprovalsPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { updateRequestStatus } = useApp();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [actionModal, setActionModal] = useState<{
    requestId: string;
    action: 'approve' | 'reject';
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const approvalForm = useForm<ApprovalFormData>({
    resolver: zodResolver(approvalSchema),
    defaultValues: { comment: '' },
  });

  const employeeIds = useMemo(() => new Set(employees.map((e) => e.id)), [employees]);

  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    if (!currentUser) return;
    loadData();
  }, [currentUser?.uid, currentUser?.role]);

  useRealtimeSubscription(
    () => {
      if (!currentUser) return undefined;
      if (!isAdmin && employees.length === 0) return undefined;
      return requestsService.subscribeToAllRequests((event) => {
        if (!isAdmin && !employeeIds.has(event.new.user_id)) return;
        if (event.eventType === 'INSERT') {
          setRequests((prev) => [event.new, ...prev]);
        } else if (event.eventType === 'UPDATE') {
          setRequests((prev) =>
            prev.map((r) => (r.id === event.new.id ? event.new : r))
          );
        }
      });
    },
    [currentUser?.uid, isAdmin, employees.length, employeeIds]
  );

  async function loadData() {
    if (!currentUser) return;
    if (!isAdmin && !currentUser.departmentId) return;
    try {
      setLoading(true);
      if (isAdmin) {
        const [profs, reqs] = await Promise.all([
          profilesService.listUsers(),
          requestsService.getAllRequests(),
        ]);
        setEmployees(profs);
        setRequests(reqs);
      } else {
        const [emps, reqs] = await Promise.all([
          profilesService.getDepartmentEmployees(currentUser.departmentId!),
          requestsService.getDepartmentRequests(currentUser.departmentId!),
        ]);
        setEmployees(emps);
        setRequests(reqs);
      }
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

  const { paginatedItems, currentPage, totalItems, pageSize, setCurrentPage } =
    usePagination(filteredRequests, PAGE_SIZE);

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  const handleAction = async (data: ApprovalFormData) => {
    if (!actionModal) return;
    setActionLoading(true);
    try {
      const status = actionModal.action === 'approve' ? 'approved' : 'rejected';
      await updateRequestStatus(actionModal.requestId, status, currentUser.uid, data.comment || '');
      setActionModal(null);
      approvalForm.reset();
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
    <PageLayout title="الموافقات">
      <FilterChips
        tabs={filterTabs}
        activeValue={filter}
        onChange={(value) => {
          setFilter(value);
          setCurrentPage(1);
        }}
      />

      {loading ? (
        <ListPageSkeleton count={3} />
      ) : filteredRequests.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />}
          title="لا توجد طلبات"
        />
      ) : (
        <>
          <div className="space-y-3">
            {paginatedItems.map((req) => (
              <RequestCard
                key={req.id}
                request={req}
                profilesMap={profilesMap}
                onUserClick={(uid) => navigate(`/user-details/${uid}`)}
                onApprove={() =>
                  setActionModal({ requestId: req.id, action: 'approve' })
                }
                onReject={() =>
                  setActionModal({ requestId: req.id, action: 'reject' })
                }
                decisionNoteLabel="ملاحظة القرار:"
              />
            ))}
          </div>

          <Pagination
            currentPage={currentPage}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </>
      )}

      {actionModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => { setActionModal(null); approvalForm.reset(); }}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl p-6"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-gray-800">
                {actionModal.action === 'approve' ? 'تأكيد الموافقة' : 'تأكيد الرفض'}
              </h2>
              <button
                onClick={() => { setActionModal(null); approvalForm.reset(); }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={approvalForm.handleSubmit(handleAction)}>
              <div className="mb-4">
                <label className="block mb-1.5 text-gray-700">ملاحظات القرار</label>
                <textarea
                  {...approvalForm.register('comment')}
                  rows={3}
                  placeholder="اكتب ملاحظاتك..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
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
                  type="button"
                  onClick={() => { setActionModal(null); approvalForm.reset(); }}
                  className="px-6 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
