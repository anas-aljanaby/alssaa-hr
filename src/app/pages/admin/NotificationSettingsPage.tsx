import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Bell, Clock, Timer, AlertTriangle, X, Pencil, BellRing } from 'lucide-react';
import { PageLayout } from '../../components/layout/PageLayout';
import { Switch } from '@/app/components/ui/switch';
import { useBodyScrollLock } from '@/app/hooks/useBodyScrollLock';
import * as notifSettingsService from '@/lib/services/notification-settings.service';
import type { NotificationSetting, NotificationSettingType } from '@/lib/services/notification-settings.service';

// ─── metadata ───────────────────────────────────────────────────────────────

type TypeMeta = {
  label: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  hasMinutes: boolean;
};

const TYPE_META: Record<NotificationSettingType, TypeMeta> = {
  pre_shift_reminder: {
    label: 'تذكير ببداية الدوام',
    description: 'يُرسَل قبل بدء الدوام بعدد الدقائق المحدد',
    icon: Bell,
    iconColor: 'text-blue-500',
    iconBg: 'bg-blue-50',
    hasMinutes: true,
  },
  work_start: {
    label: 'إشعار بداية الدوام',
    description: 'يُرسَل عند بدء وقت الدوام تماماً',
    icon: Clock,
    iconColor: 'text-emerald-500',
    iconBg: 'bg-emerald-50',
    hasMinutes: false,
  },
  punch_out_reminder: {
    label: 'تذكير قبل نهاية الدوام',
    description: 'يُرسَل قبل انتهاء الدوام بعدد الدقائق المحدد',
    icon: Timer,
    iconColor: 'text-amber-500',
    iconBg: 'bg-amber-50',
    hasMinutes: true,
  },
  auto_punch_out_alert: {
    label: 'إشعار الانصراف التلقائي',
    description: 'يُرسَل عند تسجيل الانصراف تلقائياً بسبب نسيان الموظف',
    icon: AlertTriangle,
    iconColor: 'text-red-500',
    iconBg: 'bg-red-50',
    hasMinutes: false,
  },
};

// Sort order for consistent display
const TYPE_ORDER: NotificationSettingType[] = [
  'pre_shift_reminder',
  'work_start',
  'punch_out_reminder',
  'auto_punch_out_alert',
];

// ─── component ──────────────────────────────────────────────────────────────

export function NotificationSettingsPage() {
  const [settings, setSettings] = useState<NotificationSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<NotificationSetting | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [countingDownId, setCountingDownId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(3);

  useBodyScrollLock(!!editing);

  useEffect(() => {
    notifSettingsService
      .getNotificationSettings()
      .then(setSettings)
      .catch(() => toast.error('فشل تحميل إعدادات الإشعارات'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!countingDownId) return;
    if (countdown <= 0) {
      // Fire the actual API call
      const settingId = countingDownId;
      setCountingDownId(null);
      setCountdown(3);
      setTestingId(settingId);
      notifSettingsService
        .sendNotificationSettingTest(settingId)
        .then((result) => {
          toast.success(
            result.deliveredPushes > 0
              ? 'تم إرسال الإشعار إلى جهازك'
              : 'تم إنشاء الإشعار، لكن لم يصل push إلى أي جهاز مسجَّل'
          );
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'تعذر إرسال الإشعار التجريبي';
          toast.error(message);
        })
        .finally(() => setTestingId(null));
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countingDownId, countdown]);

  const settingsByType = Object.fromEntries(
    settings.map((s) => [s.type, s])
  ) as Partial<Record<NotificationSettingType, NotificationSetting>>;

  async function handleToggle(setting: NotificationSetting) {
    setTogglingId(setting.id);
    try {
      const updated = await notifSettingsService.updateNotificationSetting(setting.id, {
        enabled: !setting.enabled,
      });
      setSettings((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch {
      toast.error('فشل تحديث الإعداد');
    } finally {
      setTogglingId(null);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      const updated = await notifSettingsService.updateNotificationSetting(editing.id, {
        title_ar: editing.title_ar,
        message_ar: editing.message_ar,
        minutes_before: editing.minutes_before,
      });
      setSettings((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      toast.success('تم حفظ الإعدادات');
      setEditing(null);
    } catch {
      toast.error('فشل حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  }

  function handleTestClick(setting: NotificationSetting) {
    if (testingId || countingDownId) return;
    setCountdown(3);
    setCountingDownId(setting.id);
  }

  if (loading) {
    return (
      <PageLayout title="إعدادات الإشعارات" backPath="/more">
        <div className="p-4 flex justify-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="إعدادات الإشعارات" backPath="/more">
      <div className="p-4 max-w-lg mx-auto space-y-3">
        <p className="text-sm text-gray-500 px-1">
          يمكنك تفعيل أو تعطيل كل نوع من الإشعارات، وتعديل نصها لجميع الموظفين.
        </p>

        {TYPE_ORDER.map((type) => {
          const setting = settingsByType[type];
          if (!setting) return null;
          const meta = TYPE_META[type];
          const Icon = meta.icon;
          const isToggling = togglingId === setting.id;
          const isTesting = testingId === setting.id;
          const isCountingDown = countingDownId === setting.id;

          return (
            <div
              key={type}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              {/* Header row */}
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.iconBg}`}>
                  <Icon className={`w-4.5 h-4.5 ${meta.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">{meta.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{meta.description}</p>
                  {meta.hasMinutes && setting.minutes_before != null && (
                    <p className="text-xs text-blue-600 mt-0.5">
                      قبل {setting.minutes_before} دقيقة
                    </p>
                  )}
                </div>
                {/* Toggle */}
                <Switch
                  checked={setting.enabled}
                  onCheckedChange={() => handleToggle(setting)}
                  disabled={isToggling}
                  aria-label={setting.enabled ? 'تعطيل' : 'تفعيل'}
                  className="data-[state=checked]:bg-blue-500 data-[state=unchecked]:bg-gray-200"
                />
              </div>

              {/* Message preview + edit button */}
              <div className="border-t border-gray-50 px-4 py-3 flex items-start justify-between gap-3">
                <p className="text-xs text-gray-500 flex-1 leading-relaxed line-clamp-2">
                  {setting.message_ar}
                </p>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="flex flex-col items-end gap-0.5">
                    <button
                      type="button"
                      onClick={() => handleTestClick(setting)}
                      disabled={!!testingId || !!countingDownId}
                      className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50"
                    >
                      <BellRing className="w-3.5 h-3.5" />
                      {isTesting
                        ? 'جاري الإرسال...'
                        : isCountingDown
                        ? `سيصل خلال ${countdown}...`
                        : 'إرسال اختبار'}
                    </button>
                    <span className="text-[10px] text-gray-400 px-2">يُرسَل إليك أنت فقط</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditing({ ...setting })}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 flex-shrink-0 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    تعديل
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Info box */}
        <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
          <p className="text-xs text-blue-700 leading-relaxed">
            <strong>ملاحظة:</strong> الإشعارات تُرسَل تلقائياً بناءً على جدول عمل الموظف أو سياسة الحضور.
            يمكن تفعيل إشعارات الجهاز (push) بضبط مفاتيح VAPID في إعدادات البيئة.
          </p>
        </div>
      </div>

      {/* Edit modal */}
      {editing && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => { if (!saving) setEditing(null); }}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-gray-800">
                تعديل — {TYPE_META[editing.type]?.label}
              </h2>
              <button
                type="button"
                onClick={() => { if (!saving) setEditing(null); }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleSave}>
              {/* Minutes before (only for timed notifications) */}
              {TYPE_META[editing.type]?.hasMinutes && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    عدد الدقائق قبل الحدث
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={editing.minutes_before ?? ''}
                    onChange={(e) =>
                      setEditing((prev) =>
                        prev ? { ...prev, minutes_before: Number(e.target.value) || null } : prev
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">عنوان الإشعار</label>
                <input
                  type="text"
                  value={editing.title_ar}
                  onChange={(e) =>
                    setEditing((prev) => prev ? { ...prev, title_ar: e.target.value } : prev)
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">نص الإشعار</label>
                <textarea
                  rows={3}
                  value={editing.message_ar}
                  onChange={(e) =>
                    setEditing((prev) => prev ? { ...prev, message_ar: e.target.value } : prev)
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 resize-none"
                  required
                />
                {editing.type === 'auto_punch_out_alert' && (
                  <p className="text-xs text-gray-400 mt-1">
                    سيُضاف وقت الانصراف تلقائياً في نهاية النص.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-50"
              >
                {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </button>
            </form>
          </div>
        </div>
      )}

    </PageLayout>
  );
}
