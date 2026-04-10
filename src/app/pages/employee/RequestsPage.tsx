import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { leaveRequestSchema, type LeaveRequestFormData } from '@/lib/validations';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { usePwa } from '../../contexts/PwaContext';
import { toast } from 'sonner';
import * as requestsService from '@/lib/services/requests.service';
import * as overtimeRequestsService from '@/lib/services/overtime-requests.service';
import * as storageService from '@/lib/services/storage.service';
import * as policyService from '@/lib/services/policy.service';
import { useRealtimeSubscription } from '@/lib/hooks/useRealtimeSubscription';
import type { LeaveRequest, RequestType } from '@/lib/services/requests.service';
import type { OvertimeRequestWithSessionAndReviewer } from '@/lib/services/overtime-requests.service';
import { Pagination, usePagination } from '../../components/Pagination';
import { ListPageSkeleton } from '../../components/skeletons';
import { Plus, FileText } from 'lucide-react';
import { PageLayout } from '../../components/layout/PageLayout';
import { FilterChips } from '../../components/shared/FilterChips';
import { RequestCard } from '../../components/shared/RequestCard';
import { OvertimeRequestCard } from '../../components/shared/OvertimeRequestCard';
import { EmptyState } from '../../components/shared/EmptyState';
import { UnavailableState } from '../../components/shared/UnavailableState';
import { useBodyScrollLock } from '@/app/hooks/useBodyScrollLock';
import { isOfflineError, OFFLINE_ACTION_MESSAGE } from '@/lib/network';
import { LeaveRequestModal } from '@/app/components/requests/LeaveRequestModal';

const PAGE_SIZE = 10;

type EmployeeRequestRow =
  | { kind: 'leave'; id: string; created_at: string; status: LeaveRequest['status']; leave: LeaveRequest }
  | {
      kind: 'overtime';
      id: string;
      created_at: string;
      status: OvertimeRequestWithSessionAndReviewer['status'];
      overtime: OvertimeRequestWithSessionAndReviewer;
    };

export function RequestsPage() {
  const { currentUser } = useAuth();
  const { submitRequest } = useApp();
  const { isOffline } = usePwa();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequestWithSessionAndReviewer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [workStartTime, setWorkStartTime] = useState<string>('08:00');
  const [loadError, setLoadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  useBodyScrollLock(showForm);

  const form = useForm<LeaveRequestFormData>({
    resolver: zodResolver(leaveRequestSchema),
    defaultValues: {
      type: 'annual_leave',
      fromDate: '',
      fromTime: '08:00',
      toDate: '',
      toTime: '16:00',
      note: '',
    },
  });

  const requestType = form.watch('type');
  const isTimeAdjustment = requestType === 'time_adjustment';

  useEffect(() => {
    if (!isTimeAdjustment) return;
    policyService.getPolicy().then((p) => {
      if (p?.work_start_time) {
        setWorkStartTime(p.work_start_time);
      }
    });
  }, [form, isTimeAdjustment]);

  const loadOvertimeRequests = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await overtimeRequestsService.getOvertimeRequestsForUser(currentUser.uid);
      setOvertimeRequests(data);
    } catch {
      toast.error('فشل تحميل طلبات العمل الإضافي');
    }
  }, [currentUser]);

  const loadRequests = useCallback(async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      const [data, ot] = await Promise.all([
        requestsService.getUserRequests(currentUser.uid),
        overtimeRequestsService.getOvertimeRequestsForUser(currentUser.uid),
      ]);
      setLoadError(null);
      setRequests(data);
      setOvertimeRequests(ot);
    } catch (error) {
      const message = isOfflineError(error)
        ? 'تعذر تحميل الطلبات بدون اتصال بالإنترنت.'
        : 'فشل تحميل الطلبات.';
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    void loadRequests();
  }, [currentUser?.uid, loadRequests]);

  useRealtimeSubscription(
    () => {
      if (!currentUser) return undefined;
      return requestsService.subscribeToUserRequests(currentUser.uid, (event) => {
        if (event.eventType === 'INSERT') {
          setRequests((prev) => [event.new, ...prev]);
        } else if (event.eventType === 'UPDATE') {
          setRequests((prev) =>
            prev.map((r) => (r.id === event.new.id ? event.new : r))
          );
        }
      });
    },
    [currentUser?.uid]
  );

  useRealtimeSubscription(
    () => {
      if (!currentUser) return undefined;
      return overtimeRequestsService.subscribeToUserOvertimeRequests(currentUser.uid, () => {
        void loadOvertimeRequests();
      });
    },
    [currentUser?.uid, loadOvertimeRequests]
  );

  if (!currentUser) return null;

  const mergedRows: EmployeeRequestRow[] = useMemo(() => {
    const leaveRows: EmployeeRequestRow[] = requests.map((r) => ({
      kind: 'leave',
      id: r.id,
      created_at: r.created_at,
      status: r.status,
      leave: r,
    }));
    const otRows: EmployeeRequestRow[] = overtimeRequests.map((r) => ({
      kind: 'overtime',
      id: r.id,
      created_at: r.created_at,
      status: r.status,
      overtime: r,
    }));
    return [...leaveRows, ...otRows].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [requests, overtimeRequests]);

  const filteredRequests = useMemo(
    () => mergedRows.filter((row) => filter === 'all' || row.status === filter),
    [mergedRows, filter]
  );

  const { paginatedItems, currentPage, totalItems, pageSize, setCurrentPage } =
    usePagination(filteredRequests, PAGE_SIZE);

  const handleFormSubmit = async (data: LeaveRequestFormData) => {
    if (isOffline) {
      toast.error(OFFLINE_ACTION_MESSAGE);
      return;
    }
    setSubmitting(true);
    try {
      let attachmentUrl: string | undefined;

      if (attachmentFile) {
        setUploading(true);
        try {
          attachmentUrl = await storageService.uploadAttachment(currentUser.uid, attachmentFile);
        } catch {
          toast.error('فشل رفع المرفق');
          setSubmitting(false);
          setUploading(false);
          return;
        }
        setUploading(false);
      }

      let fromDateTime: string;
      let toDateTime: string;
      if (data.type === 'annual_leave' || data.type === 'sick_leave') {
        fromDateTime = `${data.fromDate}T00:00:00`;
        toDateTime = `${data.toDate}T23:59:59`;
      } else if (data.type === 'time_adjustment') {
        const startTime = workStartTime.trim() || '08:00';
        const start = startTime.split(':').length === 3 ? startTime : `${startTime}:00`;
        fromDateTime = `${data.fromDate}T${start}`;
        toDateTime = fromDateTime;
      } else {
        const requestDate = data.toDate || data.fromDate;
        fromDateTime = `${data.fromDate}T${data.fromTime}:00`;
        toDateTime = `${requestDate}T${data.toTime}:00`;
      }
      await submitRequest({
        user_id: currentUser.uid,
        type: data.type,
        from_date_time: fromDateTime,
        to_date_time: toDateTime,
        note: data.note || '',
        attachment_url: attachmentUrl,
      });
      setShowForm(false);
      form.reset();
      setAttachmentFile(null);
      await loadRequests();
    } catch {
      /* toast handled by context */
    } finally {
      setSubmitting(false);
    }
  };

  const requestTypes: { value: RequestType; label: string }[] = [
    { value: 'annual_leave', label: 'إجازة سنوية' },
    { value: 'sick_leave', label: 'إجازة مرضية' },
    { value: 'hourly_permission', label: 'إجازة ساعية' },
    { value: 'time_adjustment', label: 'تعديل وقت' },
  ];

  const filterTabs = [
    { value: 'all' as const, label: 'الكل' },
    { value: 'pending' as const, label: 'قيد الانتظار' },
    { value: 'approved' as const, label: 'موافق عليها' },
    { value: 'rejected' as const, label: 'مرفوضة' },
  ];

  return (
    <PageLayout
      title="الطلبات"
    >
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
      ) : loadError && filteredRequests.length === 0 ? (
        <UnavailableState
          title="تعذر تحميل الطلبات"
          description={loadError}
          actionLabel="إعادة المحاولة"
          onAction={() => void loadRequests()}
        />
      ) : filteredRequests.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />}
          title="لا توجد طلبات"
        />
      ) : (
        <>
          <div className="space-y-3">
            {paginatedItems.map((row) =>
              row.kind === 'leave' ? (
                <RequestCard key={`leave-${row.id}`} request={row.leave} />
              ) : (
                <OvertimeRequestCard key={`ot-${row.id}`} request={row.overtime} showApproverInfo />
              )
            )}
          </div>

          <Pagination
            currentPage={currentPage}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </>
      )}

      {showForm && (
        <LeaveRequestModal
          attachmentFile={attachmentFile}
          fileInputRef={fileInputRef}
          form={form}
          onAttachmentChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            if (file && file.size > 5 * 1024 * 1024) {
              toast.error('حجم الملف يجب أن لا يتجاوز 5 ميجابايت');
              e.target.value = '';
              return;
            }
            setAttachmentFile(file);
          }}
          onAttachmentRemove={() => {
            setAttachmentFile(null);
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
          }}
          onClose={() => setShowForm(false)}
          onSubmit={handleFormSubmit}
          requestTypes={requestTypes}
          submitting={submitting}
          uploading={uploading}
          workStartTime={workStartTime}
        />
      )}
      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="fixed bottom-24 right-4 z-40 flex items-center gap-2 px-5 py-3 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm">طلب جديد</span>
        </button>
      )}
    </PageLayout>
  );
}
