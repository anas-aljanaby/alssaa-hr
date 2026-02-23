import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { leaveRequestSchema, type LeaveRequestFormData } from '@/lib/validations';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { toast } from 'sonner';
import * as requestsService from '@/lib/services/requests.service';
import * as storageService from '@/lib/services/storage.service';
import * as policyService from '@/lib/services/policy.service';
import { useRealtimeSubscription } from '@/lib/hooks/useRealtimeSubscription';
import { getRequestTypeAr, getStatusAr } from '../../data/mockData';
import type { LeaveRequest, RequestType } from '@/lib/services/requests.service';
import { Pagination, usePagination } from '../../components/Pagination';
import { ListPageSkeleton } from '../../components/skeletons';
import {
  Plus,
  X,
  Calendar,
  FileText,
  Paperclip,
  CheckCircle2,
  XCircle,
  Timer,
  Download,
  Trash2,
  Loader2,
  Info,
} from 'lucide-react';

const PAGE_SIZE = 10;

export function RequestsPage() {
  const { currentUser } = useAuth();
  const { submitRequest } = useApp();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [workStartTime, setWorkStartTime] = useState<string>('08:00');
  const [workEndTime, setWorkEndTime] = useState<string>('16:00');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const isFullDayLeave = requestType === 'annual_leave' || requestType === 'sick_leave';
  const isTimeAdjustment = requestType === 'time_adjustment';
  const isHourlyPermission = requestType === 'hourly_permission';

  useEffect(() => {
    if (!isTimeAdjustment) return;
    policyService.getPolicy().then((p) => {
      if (p?.work_start_time) {
        setWorkStartTime(p.work_start_time);
        form.setValue('fromTime', p.work_start_time);
      }
      if (p?.work_end_time) {
        setWorkEndTime(p.work_end_time);
        form.setValue('toTime', p.work_end_time);
      }
    });
  }, [isTimeAdjustment]);

  useEffect(() => {
    if (!currentUser) return;
    loadRequests();
  }, [currentUser?.uid]);

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

  async function loadRequests() {
    if (!currentUser) return;
    try {
      setLoading(true);
      const data = await requestsService.getUserRequests(currentUser.uid);
      setRequests(data);
    } catch {
      toast.error('فشل تحميل الطلبات');
    } finally {
      setLoading(false);
    }
  }

  if (!currentUser) return null;

  const filteredRequests = requests
    .filter((r) => filter === 'all' || r.status === filter)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const { paginatedItems, currentPage, totalItems, pageSize, setCurrentPage } =
    usePagination(filteredRequests, PAGE_SIZE);

  const handleFormSubmit = async (data: LeaveRequestFormData) => {
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
          const startTime = data.fromTime?.trim() || workStartTime;
          const endTime = data.toTime?.trim() || workEndTime;
          const start = startTime.split(':').length === 3 ? startTime : `${startTime}:00`;
          const end = endTime.split(':').length === 3 ? endTime : `${endTime}:00`;
          fromDateTime = `${data.fromDate}T${start}`;
          toDateTime = `${data.fromDate}T${end}`;
        } else {
          fromDateTime = `${data.fromDate}T${data.fromTime}:00`;
          toDateTime = `${data.toDate}T${data.toTime}:00`;
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

  const statusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Timer className="w-4 h-4 text-amber-500" />;
      case 'approved': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'rejected': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return null;
    }
  };

  const statusBg = (status: string) => {
    switch (status) {
      case 'pending': return 'border-r-amber-400 bg-amber-50/50';
      case 'approved': return 'border-r-emerald-400 bg-emerald-50/50';
      case 'rejected': return 'border-r-red-400 bg-red-50/50';
      default: return '';
    }
  };

  const requestTypes: { value: RequestType; label: string }[] = [
    { value: 'annual_leave', label: 'إجازة سنوية' },
    { value: 'sick_leave', label: 'إجازة مرضية' },
    { value: 'hourly_permission', label: 'إذن ساعي' },
    { value: 'time_adjustment', label: 'تعديل وقت' },
  ];

  const filterTabs = [
    { value: 'all' as const, label: 'الكل' },
    { value: 'pending' as const, label: 'قيد الانتظار' },
    { value: 'approved' as const, label: 'موافق عليها' },
    { value: 'rejected' as const, label: 'مرفوضة' },
  ];

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-gray-800">الطلبات</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          طلب جديد
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setFilter(tab.value); setCurrentPage(1); }}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
              filter === tab.value
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <ListPageSkeleton count={3} />
      ) : filteredRequests.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>لا توجد طلبات</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {paginatedItems.map((req) => (
              <div
                key={req.id}
                className={`bg-white rounded-xl p-4 border border-gray-100 border-r-4 shadow-sm ${statusBg(req.status)}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {statusIcon(req.status)}
                    <span className="text-gray-800">{getRequestTypeAr(req.type)}</span>
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

                <div className="flex items-center gap-4 text-xs text-gray-500 mb-2 flex-wrap">
                  {req.type === 'time_adjustment' ? (
                    <div className="flex items-center gap-1 flex-wrap">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        {new Date(req.from_date_time).toLocaleDateString('ar-IQ')}
                        {' — '}
                        {new Date(req.from_date_time).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                        {' → '}
                        {new Date(req.to_date_time).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>من: {new Date(req.from_date_time).toLocaleDateString('ar-IQ')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>إلى: {new Date(req.to_date_time).toLocaleDateString('ar-IQ')}</span>
                      </div>
                    </>
                  )}
                </div>

                {req.note && (
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-2 mb-2">{req.note}</p>
                )}

                {req.attachment_url && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const url = await storageService.getAttachmentUrl(req.attachment_url!);
                        window.open(url, '_blank');
                      } catch {
                        toast.error('فشل فتح المرفق');
                      }
                    }}
                    className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg px-2.5 py-1.5 mb-2 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    عرض المرفق
                  </button>
                )}

                {req.decision_note && (
                  <div
                    className={`text-sm p-2 rounded-lg ${
                      req.status === 'approved'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-red-50 text-red-700'
                    }`}
                  >
                    <span className="text-xs opacity-70">ملاحظة المدير: </span>
                    {req.decision_note}
                  </div>
                )}

                <div className="text-xs text-gray-400 mt-2">
                  {new Date(req.created_at).toLocaleDateString('ar-IQ', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
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

      {showForm && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-xl rounded-3xl shadow-2xl
                       max-h-[92vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">
                طلب جديد
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-2 rounded-full hover:bg-gray-100 transition"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form
              onSubmit={form.handleSubmit(handleFormSubmit)}
              className="p-6 space-y-8"
            >
              {/* ======================= */}
              {/* Request Type Section */}
              {/* ======================= */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  نوع الطلب
                </label>

                <select
                  {...form.register('type')}
                  className="w-full h-12 px-4 rounded-xl border border-gray-200
                             bg-white focus:ring-2 focus:ring-blue-500/20
                             focus:border-blue-500 outline-none transition"
                >
                  {requestTypes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* ======================= */}
              {/* Date & Time Section */}
              {/* ======================= */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-4">
                    تفاصيل التاريخ والوقت
                  </h3>

                  {/* From Date */}
                  <div className="space-y-2">
                    <label className="text-sm text-gray-600">
                      {isTimeAdjustment ? 'التاريخ' : 'من تاريخ'}
                    </label>

                    <input
                      type="date"
                      {...form.register('fromDate')}
                      className={`w-full h-12 px-4 rounded-xl border
                                 focus:ring-2 focus:ring-blue-500/20
                                 focus:border-blue-500 outline-none transition ${
                        form.formState.errors.fromDate ? 'border-red-400' : 'border-gray-200'
                      }`}
                    />

                    {form.formState.errors.fromDate && (
                      <p className="text-xs text-red-500">
                        {form.formState.errors.fromDate.message}
                      </p>
                    )}
                  </div>

                  {/* Time Fields */}
                  {(isTimeAdjustment || isHourlyPermission) && (
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className="space-y-2">
                        <label className="text-sm text-gray-600">
                          من وقت
                        </label>
                        <input
                          type="time"
                          {...form.register('fromTime')}
                          className="w-full h-12 px-4 rounded-xl border border-gray-200
                                     focus:ring-2 focus:ring-blue-500/20
                                     focus:border-blue-500 outline-none transition"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm text-gray-600">
                          إلى وقت
                        </label>
                        <input
                          type="time"
                          {...form.register('toTime')}
                          className={`w-full h-12 px-4 rounded-xl border
                                     focus:ring-2 focus:ring-blue-500/20
                                     focus:border-blue-500 outline-none transition ${
                            form.formState.errors.toTime ? 'border-red-400' : 'border-gray-200'
                          }`}
                        />
                        {form.formState.errors.toTime && (
                          <p className="text-xs text-red-500">
                            {form.formState.errors.toTime.message}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* To Date (Full Day Leave) */}
                  {(isFullDayLeave || isHourlyPermission) && (
                    <div className="space-y-2 mt-4">
                      <label className="text-sm text-gray-600">
                        إلى تاريخ
                      </label>
                      <input
                        type="date"
                        {...form.register('toDate')}
                        className={`w-full h-12 px-4 rounded-xl border
                                   focus:ring-2 focus:ring-blue-500/20
                                   focus:border-blue-500 outline-none transition ${
                          form.formState.errors.toDate ? 'border-red-400' : 'border-gray-200'
                        }`}
                      />
                      {form.formState.errors.toDate && (
                        <p className="text-xs text-red-500">
                          {form.formState.errors.toDate.message}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Subtle helper note */}
                {isTimeAdjustment && (
                  <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
                    الوقت الافتراضي هو وقت الدوام الرسمي. قم بتعديله إذا
                    تأخرت أو انصرفت مبكراً.
                  </p>
                )}
              </div>

              {/* ======================= */}
              {/* Notes */}
              {/* ======================= */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  ملاحظات
                </label>

                <textarea
                  {...form.register('note')}
                  rows={3}
                  placeholder="اكتب ملاحظاتك هنا..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200
                             focus:ring-2 focus:ring-blue-500/20
                             focus:border-blue-500 outline-none resize-none"
                />
              </div>

              {/* ======================= */}
              {/* Attachment */}
              {/* ======================= */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    if (file && file.size > 5 * 1024 * 1024) {
                      toast.error('حجم الملف يجب أن لا يتجاوز 5 ميجابايت');
                      e.target.value = '';
                      return;
                    }
                    setAttachmentFile(file);
                  }}
                />

                {attachmentFile ? (
                  <div className="flex items-center justify-between px-4 py-3
                                  bg-gray-50 rounded-xl border border-gray-200 text-sm">
                    <span className="truncate text-gray-700">
                      {attachmentFile.name}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        setAttachmentFile(null);
                        if (fileInputRef.current)
                          fileInputRef.current.value = '';
                      }}
                      className="text-red-500 hover:text-red-600 text-xs"
                    >
                      إزالة
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-12 rounded-xl border border-dashed
                               border-gray-300 text-gray-500 hover:bg-gray-50
                               transition text-sm"
                  >
                    إرفاق ملف (اختياري)
                  </button>
                )}
              </div>

              {/* ======================= */}
              {/* Submit */}
              {/* ======================= */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700
                           text-white font-medium transition
                           disabled:opacity-50 flex items-center
                           justify-center gap-2"
              >
                {submitting && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {uploading
                  ? 'جاري رفع المرفق...'
                  : submitting
                    ? 'جاري الإرسال...'
                    : 'إرسال الطلب'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
