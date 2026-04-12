import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageLayout } from '@/app/components/layout/PageLayout';
import {
  getNotificationTemplates,
  updateNotificationTemplates,
  DEFAULT_CHECK_IN_MESSAGE,
  DEFAULT_CHECK_OUT_MESSAGE,
} from '@/lib/services/notification-templates.service';
import { LoaderCircle } from 'lucide-react';

export function NotificationSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkInMsg, setCheckInMsg] = useState('');
  const [checkOutMsg, setCheckOutMsg] = useState('');

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      setLoading(true);
      const templates = await getNotificationTemplates();
      setCheckInMsg(templates.checkInMessage ?? '');
      setCheckOutMsg(templates.checkOutMessage ?? '');
    } catch {
      toast.error('فشل تحميل إعدادات الإشعارات');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateNotificationTemplates({
        checkInMessage: checkInMsg.trim() || null,
        checkOutMessage: checkOutMsg.trim() || null,
      });
      toast.success('تم حفظ إعدادات الإشعارات بنجاح');
    } catch {
      toast.error('فشل حفظ إعدادات الإشعارات');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageLayout title="إعدادات الإشعارات" backPath="/more">
      {loading ? (
        <div className="space-y-4">
          <div className="bg-gray-100 rounded-2xl h-40 animate-pulse" />
          <div className="bg-gray-100 rounded-2xl h-40 animate-pulse" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Check-in notification */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-medium text-gray-800 mb-1">إشعار تسجيل الحضور</h3>
            <p className="text-xs text-gray-400 mb-3">
              يُرسل للموظف عند تسجيل حضوره. استخدم {'{time}'} لعرض الوقت.
            </p>
            <textarea
              value={checkInMsg}
              onChange={(e) => setCheckInMsg(e.target.value)}
              placeholder={DEFAULT_CHECK_IN_MESSAGE}
              rows={3}
              dir="rtl"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Check-out notification */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-medium text-gray-800 mb-1">إشعار تسجيل الانصراف</h3>
            <p className="text-xs text-gray-400 mb-3">
              يُرسل للموظف عند تسجيل انصرافه تلقائياً. استخدم {'{time}'} لعرض الوقت.
            </p>
            <textarea
              value={checkOutMsg}
              onChange={(e) => setCheckOutMsg(e.target.value)}
              placeholder={DEFAULT_CHECK_OUT_MESSAGE}
              rows={3}
              dir="rtl"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium"
          >
            {saving && <LoaderCircle className="w-4 h-4 animate-spin" />}
            {saving ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}
          </button>
        </div>
      )}
    </PageLayout>
  );
}
