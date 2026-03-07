import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import * as policyService from '@/lib/services/policy.service';
import type { AttendancePolicy } from '@/lib/services/policy.service';
import { Clock, Calendar, Settings, X } from 'lucide-react';
import { PageLayout } from '../../components/layout/PageLayout';

const dayNames: Record<number, string> = {
  0: 'الأحد',
  1: 'الاثنين',
  2: 'الثلاثاء',
  3: 'الأربعاء',
  4: 'الخميس',
  5: 'الجمعة',
  6: 'السبت',
};

function PolicyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm text-gray-800 bg-gray-50 px-3 py-1 rounded-lg">{value}</span>
    </div>
  );
}

export function AttendancePolicyPage() {
  const { currentUser } = useAuth();
  const [policy, setPolicy] = useState<AttendancePolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditPolicy, setShowEditPolicy] = useState(false);
  const [editPolicy, setEditPolicy] = useState<AttendancePolicy | null>(null);
  const [savingPolicy, setSavingPolicy] = useState(false);

  useEffect(() => {
    policyService
      .getPolicy()
      .then(setPolicy)
      .catch(() => toast.error('فشل تحميل سياسة الحضور'))
      .finally(() => setLoading(false));
  }, []);

  if (!currentUser) return null;

  const isAdmin = currentUser.role === 'admin';

  if (loading) {
    return (
      <PageLayout title="سياسة الحضور" backPath="/more">
        <div className="p-4 flex justify-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="سياسة الحضور" backPath="/more">
      <div className="p-4 max-w-lg mx-auto space-y-4">
        {policy ? (
          <>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-500" />
                  <h3 className="text-gray-800">إعدادات الدوام</h3>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditPolicy(policy);
                      setShowEditPolicy(true);
                    }}
                    className="px-3 py-1.5 text-xs rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    تعديل
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <PolicyRow label="وقت بدء العمل" value={policy.work_start_time} />
                <PolicyRow label="وقت نهاية العمل" value={policy.work_end_time} />
                <PolicyRow
                  label="فترة السماح (دقيقة)"
                  value={`${policy.grace_period_minutes} دقيقة`}
                />
                <PolicyRow
                  label="مهلة الانصراف التلقائي (دقيقة)"
                  value={`${policy.auto_punch_out_buffer_minutes ?? 30} دقيقة`}
                />
                <PolicyRow label="وقت قطع الغياب" value={policy.absent_cutoff_time} />
                <PolicyRow
                  label="أيام الإجازة الأسبوعية"
                  value={policy.weekly_off_days.map((d) => dayNames[d]).join(' و ')}
                />
                <PolicyRow
                  label="الحد الأقصى للتأخر قبل التنبيه"
                  value={`${policy.max_late_days_before_warning} أيام`}
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-emerald-500" />
                <h3 className="text-gray-800">سياسة الإجازات</h3>
              </div>

              <div className="space-y-3">
                <PolicyRow
                  label="الإجازة السنوية"
                  value={`${policy.annual_leave_per_year} يوم`}
                />
                <PolicyRow
                  label="الإجازة المرضية"
                  value={`${policy.sick_leave_per_year} يوم`}
                />
              </div>
            </div>

            <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200">
              <h4 className="text-blue-800 mb-2">منطق التصنيف</h4>
              <div className="space-y-2 text-sm text-blue-700">
                <p>
                  • <strong>حاضر:</strong> تسجيل الحضور قبل انتهاء فترة السماح
                </p>
                <p>
                  • <strong>متأخر:</strong> تسجيل الحضور بعد فترة السماح
                </p>
                <p>
                  • <strong>غائب:</strong> عدم تسجيل الحضور قبل وقت القطع
                </p>
                <p>
                  • <strong>في إجازة:</strong> وجود طلب إجازة معتمد يتداخل مع التاريخ
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <Settings className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>لم يتم تعيين سياسة الحضور بعد</p>
          </div>
        )}
      </div>

      {isAdmin && showEditPolicy && editPolicy && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            if (savingPolicy) return;
            setShowEditPolicy(false);
          }}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-gray-800">تعديل سياسة الحضور</h2>
              <button
                type="button"
                onClick={() => {
                  if (savingPolicy) return;
                  setShowEditPolicy(false);
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!editPolicy) return;
                try {
                  setSavingPolicy(true);
                  const updated = await policyService.updatePolicy({
                    work_start_time: editPolicy.work_start_time,
                    work_end_time: editPolicy.work_end_time,
                    grace_period_minutes: editPolicy.grace_period_minutes,
                    auto_punch_out_buffer_minutes: editPolicy.auto_punch_out_buffer_minutes ?? 30,
                    absent_cutoff_time: editPolicy.absent_cutoff_time,
                    weekly_off_days: editPolicy.weekly_off_days,
                    max_late_days_before_warning: editPolicy.max_late_days_before_warning,
                    annual_leave_per_year: editPolicy.annual_leave_per_year,
                    sick_leave_per_year: editPolicy.sick_leave_per_year,
                  });
                  setPolicy(updated);
                  toast.success('تم تحديث سياسة الحضور');
                  setShowEditPolicy(false);
                } catch {
                  toast.error('فشل تحديث سياسة الحضور');
                } finally {
                  setSavingPolicy(false);
                }
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">وقت بدء العمل</label>
                  <input
                    type="time"
                    value={editPolicy.work_start_time}
                    onChange={(e) =>
                      setEditPolicy((prev) => prev ? { ...prev, work_start_time: e.target.value } : prev)
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">وقت نهاية العمل</label>
                  <input
                    type="time"
                    value={editPolicy.work_end_time}
                    onChange={(e) =>
                      setEditPolicy((prev) => prev ? { ...prev, work_end_time: e.target.value } : prev)
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">فترة السماح (دقيقة)</label>
                  <input
                    type="number"
                    value={editPolicy.grace_period_minutes}
                    onChange={(e) =>
                      setEditPolicy((prev) =>
                        prev ? { ...prev, grace_period_minutes: Number(e.target.value) || 0 } : prev
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">مهلة الانصراف التلقائي (دقيقة)</label>
                  <input
                    type="number"
                    value={editPolicy.auto_punch_out_buffer_minutes ?? 30}
                    onChange={(e) =>
                      setEditPolicy((prev) =>
                        prev ? { ...prev, auto_punch_out_buffer_minutes: Number(e.target.value) || 0 } : prev
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">وقت قطع الغياب</label>
                  <input
                    type="time"
                    value={editPolicy.absent_cutoff_time}
                    onChange={(e) =>
                      setEditPolicy((prev) => prev ? { ...prev, absent_cutoff_time: e.target.value } : prev)
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-2">أيام الإجازة الأسبوعية</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { d: 0, label: 'الأحد' },
                    { d: 1, label: 'الاثنين' },
                    { d: 2, label: 'الثلاثاء' },
                    { d: 3, label: 'الأربعاء' },
                    { d: 4, label: 'الخميس' },
                    { d: 5, label: 'الجمعة' },
                    { d: 6, label: 'السبت' },
                  ].map(({ d, label }) => {
                    const checked = editPolicy.weekly_off_days.includes(d);
                    return (
                      <label
                        key={d}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                          checked ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setEditPolicy((prev) => {
                              if (!prev) return prev;
                              const exists = prev.weekly_off_days.includes(d);
                              const next = exists
                                ? prev.weekly_off_days.filter((x) => x !== d)
                                : [...prev.weekly_off_days, d].sort((a, b) => a - b);
                              return { ...prev, weekly_off_days: next };
                            })
                          }
                          className="rounded border-gray-300"
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    الحد الأقصى للتأخر قبل التنبيه (أيام)
                  </label>
                  <input
                    type="number"
                    value={editPolicy.max_late_days_before_warning}
                    onChange={(e) =>
                      setEditPolicy((prev) =>
                        prev ? { ...prev, max_late_days_before_warning: Number(e.target.value) || 0 } : prev
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">الإجازة السنوية (يوم)</label>
                  <input
                    type="number"
                    value={editPolicy.annual_leave_per_year}
                    onChange={(e) =>
                      setEditPolicy((prev) =>
                        prev ? { ...prev, annual_leave_per_year: Number(e.target.value) || 0 } : prev
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">الإجازة المرضية (يوم)</label>
                  <input
                    type="number"
                    value={editPolicy.sick_leave_per_year}
                    onChange={(e) =>
                      setEditPolicy((prev) =>
                        prev ? { ...prev, sick_leave_per_year: Number(e.target.value) || 0 } : prev
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingPolicy}
                className="w-full py-3 mt-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-50"
              >
                {savingPolicy ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </button>
            </form>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
