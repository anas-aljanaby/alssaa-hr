import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { toast } from 'sonner';
import * as requestsService from '@/lib/services/requests.service';
import { getRequestTypeAr, getStatusAr } from '../../data/mockData';
import type { LeaveRequest, RequestType } from '@/lib/services/requests.service';
import {
  Plus,
  X,
  Calendar,
  FileText,
  Paperclip,
  CheckCircle2,
  XCircle,
  Timer,
} from 'lucide-react';

export function RequestsPage() {
  const { currentUser } = useAuth();
  const { submitRequest } = useApp();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [formData, setFormData] = useState({
    type: 'annual_leave' as RequestType,
    fromDate: '',
    fromTime: '08:00',
    toDate: '',
    toTime: '16:00',
    note: '',
  });

  useEffect(() => {
    if (!currentUser) return;
    loadRequests();
  }, [currentUser?.uid]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await submitRequest({
        user_id: currentUser.uid,
        type: formData.type,
        from_date_time: `${formData.fromDate}T${formData.fromTime}:00`,
        to_date_time: `${formData.toDate}T${formData.toTime}:00`,
        note: formData.note,
      });
      setShowForm(false);
      setFormData({
        type: 'annual_leave',
        fromDate: '',
        fromTime: '08:00',
        toDate: '',
        toTime: '16:00',
        note: '',
      });
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
            onClick={() => setFilter(tab.value)}
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
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-28 animate-pulse" />
          ))}
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>لا توجد طلبات</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((req) => (
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

              <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>من: {new Date(req.from_date_time).toLocaleDateString('ar-IQ')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>إلى: {new Date(req.to_date_time).toLocaleDateString('ar-IQ')}</span>
                </div>
              </div>

              {req.note && (
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-2 mb-2">{req.note}</p>
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
      )}

      {/* New Request Modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end z-50"
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-white rounded-t-3xl w-full max-w-lg mx-auto p-6 max-h-[85vh] overflow-auto"
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

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block mb-1.5 text-gray-700">نوع الطلب</label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, type: e.target.value as RequestType }))
                  }
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  {requestTypes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1.5 text-gray-700">من تاريخ</label>
                  <input
                    type="date"
                    value={formData.fromDate}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, fromDate: e.target.value }))
                    }
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block mb-1.5 text-gray-700">من وقت</label>
                  <input
                    type="time"
                    value={formData.fromTime}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, fromTime: e.target.value }))
                    }
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1.5 text-gray-700">إلى تاريخ</label>
                  <input
                    type="date"
                    value={formData.toDate}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, toDate: e.target.value }))
                    }
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block mb-1.5 text-gray-700">إلى وقت</label>
                  <input
                    type="time"
                    value={formData.toTime}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, toTime: e.target.value }))
                    }
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1.5 text-gray-700">ملاحظات</label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData((prev) => ({ ...prev, note: e.target.value }))}
                  rows={3}
                  placeholder="اكتب ملاحظاتك هنا..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none"
                />
              </div>

              <div>
                <button
                  type="button"
                  className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-gray-300 rounded-xl text-gray-500 hover:bg-gray-50 w-full justify-center"
                >
                  <Paperclip className="w-4 h-4" />
                  إرفاق ملف (اختياري)
                </button>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-colors"
              >
                {submitting ? 'جاري الإرسال...' : 'إرسال الطلب'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
