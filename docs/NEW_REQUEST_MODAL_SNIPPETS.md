# New Request Modal — Code Snippets

Component: **New Request** modal in `src/app/pages/employee/RequestsPage.tsx`.  
Form validation: `leaveRequestSchema` in `src/lib/validations.ts`.  
Submit: `handleFormSubmit` + `submitRequest` from `AppContext`.  
Modal opens when `showForm` is true (e.g. after clicking "طلب جديد").

---

## 1. Imports and types

```tsx
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
```

---

## 2. State and form setup (used by the modal)

```tsx
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
```

---

## 3. Request types and policy for "تعديل وقت"

```tsx
  const requestTypes: { value: RequestType; label: string }[] = [
    { value: 'annual_leave', label: 'إجازة سنوية' },
    { value: 'sick_leave', label: 'إجازة مرضية' },
    { value: 'hourly_permission', label: 'إذن ساعي' },
    { value: 'time_adjustment', label: 'تعديل وقت' },
  ];
```

```tsx
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
```

---

## 4. Derived flags (control which fields show)

```tsx
  const requestType = form.watch('type');
  const isFullDayLeave = requestType === 'annual_leave' || requestType === 'sick_leave';
  const isTimeAdjustment = requestType === 'time_adjustment';
  const isHourlyPermission = requestType === 'hourly_permission';
```

---

## 5. Submit handler (used when clicking "إرسال الطلب")

```tsx
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
```

---

## 6. The modal + form (the exact UI in the screenshot)

```tsx
      {showForm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl p-6"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-gray-800">طلب جديد</h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
              <div>
                <label className="block mb-1.5 text-gray-700">نوع الطلب</label>
                <select
                  {...form.register('type')}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  {requestTypes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* من تاريخ — always shown */}
              <div className={isFullDayLeave ? '' : 'grid grid-cols-2 gap-3'}>
                <div>
                  <label className="block mb-1.5 text-gray-700">
                    {isTimeAdjustment ? 'التاريخ' : 'من تاريخ'}
                  </label>
                  <input
                    type="date"
                    {...form.register('fromDate')}
                    className={`w-full px-4 py-3 border rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
                      form.formState.errors.fromDate ? 'border-red-400' : 'border-gray-200'
                    }`}
                  />
                  {form.formState.errors.fromDate && (
                    <p className="text-red-500 text-xs mt-1">{form.formState.errors.fromDate.message}</p>
                  )}
                </div>
                {(isTimeAdjustment || isHourlyPermission) && (
                  <div>
                    <label className="block mb-1.5 text-gray-700">من وقت</label>
                    <input
                      type="time"
                      {...form.register('fromTime')}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                    {isTimeAdjustment && (
                      <div className="mt-1.5 flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
                        <Info className="w-4 h-4 shrink-0 mt-0.5 text-sky-500" />
                        <span>الوقت الافتراضي هو بداية يوم العمل. قم تغييره إذا تأخرت عن الدخول.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* وقت النهاية — for time adjustment only (same day) */}
              {isTimeAdjustment && (
                <div>
                  <label className="block mb-1.5 text-gray-700">إلى وقت</label>
                  <input
                    type="time"
                    {...form.register('toTime')}
                    className={`w-full px-4 py-3 border rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
                      form.formState.errors.toTime ? 'border-red-400' : 'border-gray-200'
                    }`}
                  />
                  {form.formState.errors.toTime && (
                    <p className="text-red-500 text-xs mt-1">{form.formState.errors.toTime.message}</p>
                  )}
                  <div className="mt-1.5 flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
                    <Info className="w-4 h-4 shrink-0 mt-0.5 text-sky-500" />
                    <span>الوقت الافتراضي هو نهاية يوم العمل. قم تغييره إذا انصرفت مبكراً.</span>
                  </div>
                </div>
              )}

              {/* إلى تاريخ / إلى وقت — only for full-day leave and hourly permission */}
              {(isFullDayLeave || isHourlyPermission) && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1.5 text-gray-700">إلى تاريخ</label>
                    <input
                      type="date"
                      {...form.register('toDate')}
                      className={`w-full px-4 py-3 border rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
                        form.formState.errors.toDate ? 'border-red-400' : 'border-gray-200'
                      }`}
                    />
                    {form.formState.errors.toDate && (
                      <p className="text-red-500 text-xs mt-1">{form.formState.errors.toDate.message}</p>
                    )}
                  </div>
                  {isHourlyPermission && (
                    <div>
                      <label className="block mb-1.5 text-gray-700">إلى وقت</label>
                      <input
                        type="time"
                        {...form.register('toTime')}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block mb-1.5 text-gray-700">ملاحظات</label>
                <textarea
                  {...form.register('note')}
                  rows={3}
                  placeholder="اكتب ملاحظاتك هنا..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none"
                />
              </div>

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
                  <div className="flex items-center gap-2 px-4 py-2.5 border border-blue-200 bg-blue-50 rounded-xl text-sm">
                    <Paperclip className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="text-blue-700 truncate flex-1">{attachmentFile.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAttachmentFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="p-1 hover:bg-blue-100 rounded-full"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-gray-300 rounded-xl text-gray-500 hover:bg-gray-50 w-full justify-center"
                  >
                    <Paperclip className="w-4 h-4" />
                    إرفاق ملف (اختياري)
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {uploading ? 'جاري رفع المرفق...' : submitting ? 'جاري الإرسال...' : 'إرسال الطلب'}
              </button>
            </form>
          </div>
        </div>
      )}
```
