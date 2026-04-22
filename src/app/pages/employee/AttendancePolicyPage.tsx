import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { useBodyScrollLock } from '@/app/hooks/useBodyScrollLock';
import * as policyService from '@/lib/services/policy.service';
import type { AttendancePolicy, AutoPunchOutRule } from '@/lib/services/policy.service';
import {
  Clock,
  Calendar,
  Settings,
  X,
  Plus,
  Trash2,
  AlarmClock,
  CalendarDays,
  Timer,
  Pencil,
} from 'lucide-react';
import { PageLayout } from '../../components/layout/PageLayout';
import {
  DEFAULT_AUTO_PUNCH_OUT_BUFFER_MINUTES,
  DEFAULT_MINIMUM_OVERTIME_MINUTES,
} from '@/shared/attendance/constants';
import { WorkScheduleEditor } from '@/shared/attendance/WorkScheduleEditor';
import type { WorkSchedule } from '@/shared/attendance/workSchedule';

// ─── Types ────────────────────────────────────────────────────────────────────

type EditSection = 'schedule' | 'punchout' | 'overtime' | 'rest' | 'leave';
type TabKey = 'schedule' | 'rules';

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_NAMES_AR: Record<string, string> = {
  '0': 'الأحد',
  '1': 'الاثنين',
  '2': 'الثلاثاء',
  '3': 'الأربعاء',
  '4': 'الخميس',
  '5': 'الجمعة',
  '6': 'السبت',
};

const SESSION_TYPE_LABELS: Record<AutoPunchOutRule['sessionType'], string> = {
  all: 'جميع الجلسات',
  overtime: 'العمل الإضافي فقط',
  regular: 'الدوام العادي فقط',
};

const SECTION_TITLES: Record<EditSection, string> = {
  schedule: 'جدول العمل',
  punchout: 'الانصراف التلقائي',
  overtime: 'العمل الإضافي',
  rest: 'التنبيهات',
  leave: 'سياسة الإجازات',
};

const SECTION_SUCCESS: Record<EditSection, string> = {
  schedule: 'تم تحديث جدول العمل',
  punchout: 'تم تحديث إعدادات الانصراف التلقائي',
  overtime: 'تم تحديث إعدادات العمل الإضافي',
  rest: 'تم تحديث إعدادات التنبيهات',
  leave: 'تم تحديث سياسة الإجازات',
};

// Constrained input widths — prevents overflow on narrow phones
const TIME_INPUT = 'w-24 px-2.5 py-1.5 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 outline-none text-sm font-medium transition-colors text-center';
const NUM_INPUT  = 'w-20 px-2.5 py-1.5 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 outline-none text-sm font-medium transition-colors text-center';

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Shared display components ────────────────────────────────────────────────

function PolicyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-dashed border-gray-100 last:border-0">
      <span className="text-xs text-gray-600 font-medium">{label}</span>
      <span className="text-sm text-gray-800 font-semibold">{value}</span>
    </div>
  );
}

function ScheduleRow({ dayKey, schedule }: { dayKey: string; schedule: WorkSchedule }) {
  const day = schedule[dayKey as '0' | '1' | '2' | '3' | '4' | '5' | '6'];
  return (
    <div className="flex items-center justify-between py-2 border-b border-dashed border-gray-100 last:border-0">
      <span className="text-xs text-gray-600 font-medium">{DAY_NAMES_AR[dayKey]}</span>
      {day ? (
        <span dir="ltr" className="text-sm text-gray-800 font-semibold">
          {day.start} – {day.end}
        </span>
      ) : (
        <span className="text-xs text-gray-400 font-medium">راحة</span>
      )}
    </div>
  );
}

function AutoPunchOutRuleCard({ rule }: { rule: AutoPunchOutRule }) {
  return (
    <div
      className={`flex items-center justify-between p-3 rounded-xl border transition-opacity ${
        rule.enabled ? 'bg-white border-amber-100' : 'bg-gray-50 border-gray-100 opacity-50'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full shrink-0 ${rule.enabled ? 'bg-amber-400' : 'bg-gray-300'}`} />
        <div>
          <p className="text-sm text-gray-800 font-semibold">{rule.title}</p>
          <p className="text-xs text-gray-400 mt-0.5 font-medium">{rule.time}</p>
        </div>
      </div>
      <span className="text-xs px-2 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-100 font-medium">
        {SESSION_TYPE_LABELS[rule.sessionType]}
      </span>
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500 font-medium shrink-0">{label}</span>
      {children}
    </div>
  );
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────

function PolicyCard({
  icon,
  iconBg,
  title,
  accentBorder,
  onEdit,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  accentBorder: string;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`bg-white rounded-2xl border border-gray-100 border-r-4 ${accentBorder}`}
      style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}
    >
      <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-gray-50">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
            {icon}
          </div>
          <h3 className="text-gray-800 text-sm font-semibold">{title}</h3>
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-blue-100 text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors font-medium"
          >
            <Pencil className="w-3 h-3" />
            تعديل
          </button>
        )}
      </div>
      <div className="px-4 pb-3 pt-1">{children}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AttendancePolicyPage() {
  // ── State ──────────────────────────────────────────────────────────────────
  const { currentUser } = useAuth();
  const [policy, setPolicy] = useState<AttendancePolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('schedule');
  const [activeSection, setActiveSection] = useState<EditSection | null>(null);
  const [editPolicy, setEditPolicy] = useState<AttendancePolicy | null>(null);
  const [savingPolicy, setSavingPolicy] = useState(false);

  useBodyScrollLock(activeSection !== null);

  // ── Data loading ───────────────────────────────────────────────────────────
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

  // ── Section helpers ────────────────────────────────────────────────────────
  function openSection(section: EditSection) {
    setEditPolicy(policy);
    setActiveSection(section);
  }

  function closeSection() {
    if (savingPolicy) return;
    setActiveSection(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editPolicy || !activeSection) return;
    try {
      setSavingPolicy(true);
      const updated = await policyService.updatePolicy({
        work_schedule: editPolicy.work_schedule,
        grace_period_minutes: editPolicy.grace_period_minutes,
        absent_cutoff_time: editPolicy.absent_cutoff_time,
        auto_punch_out_buffer_minutes:
          editPolicy.auto_punch_out_buffer_minutes ?? DEFAULT_AUTO_PUNCH_OUT_BUFFER_MINUTES,
        auto_punch_out_rules: editPolicy.auto_punch_out_rules,
        minimum_overtime_minutes:
          editPolicy.minimum_overtime_minutes ?? DEFAULT_MINIMUM_OVERTIME_MINUTES,
        max_late_days_before_warning: editPolicy.max_late_days_before_warning,
        annual_leave_per_year: editPolicy.annual_leave_per_year,
      });
      setPolicy(updated);
      toast.success(SECTION_SUCCESS[activeSection]);
      setActiveSection(null);
    } catch {
      toast.error('فشل حفظ التغييرات');
    } finally {
      setSavingPolicy(false);
    }
  }

  // ── Rule helpers ───────────────────────────────────────────────────────────
  function addRule() {
    setEditPolicy((prev) =>
      prev
        ? {
            ...prev,
            auto_punch_out_rules: [
              ...prev.auto_punch_out_rules,
              { id: generateId(), title: '', time: '02:00', sessionType: 'all', enabled: true },
            ],
          }
        : prev
    );
  }

  function removeRule(id: string) {
    setEditPolicy((prev) =>
      prev ? { ...prev, auto_punch_out_rules: prev.auto_punch_out_rules.filter((r) => r.id !== id) } : prev
    );
  }

  function updateRule(id: string, patch: Partial<AutoPunchOutRule>) {
    setEditPolicy((prev) =>
      prev
        ? {
            ...prev,
            auto_punch_out_rules: prev.auto_punch_out_rules.map((r) =>
              r.id === id ? { ...r, ...patch } : r
            ),
          }
        : prev
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <PageLayout title="سياسة الحضور" backPath="/more">

      {/* ── Tab bar ──────────────────────────────────────────────────────────── */}
      <div className="px-4 pt-2 pb-0" dir="rtl">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {([
            { key: 'schedule', label: 'الدوام والإجازات' },
            { key: 'rules',    label: 'قواعد الحضور'    },
          ] as { key: TabKey; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === key
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        {policy ? (
          <>
            {/* ── Tab 1: الدوام والإجازات ────────────────────────────────────── */}
            {activeTab === 'schedule' && (
              <>
                <PolicyCard
                  icon={<Clock className="w-4 h-4 text-blue-500" />}
                  iconBg="bg-blue-50"
                  accentBorder="border-r-blue-300"
                  title="جدول العمل"
                  onEdit={isAdmin ? () => openSection('schedule') : undefined}
                >
                  {(['0', '1', '2', '3', '4', '5', '6'] as const).map((dow) => (
                    <ScheduleRow key={dow} dayKey={dow} schedule={policy.work_schedule} />
                  ))}
                  <PolicyRow label="فترة السماح" value={`${policy.grace_period_minutes} دقيقة`} />
                  <PolicyRow label="وقت قطع الغياب" value={policy.absent_cutoff_time} />
                </PolicyCard>

                <PolicyCard
                  icon={<Calendar className="w-4 h-4 text-indigo-500" />}
                  iconBg="bg-indigo-50"
                  accentBorder="border-r-indigo-300"
                  title="سياسة الإجازات"
                  onEdit={isAdmin ? () => openSection('leave') : undefined}
                >
                  <PolicyRow label="الإجازة السنوية" value={`${policy.annual_leave_per_year} يوم`} />
                </PolicyCard>
              </>
            )}

            {/* ── Tab 2: قواعد الحضور ────────────────────────────────────────── */}
            {activeTab === 'rules' && (
              <>
                <PolicyCard
                  icon={<AlarmClock className="w-4 h-4 text-amber-500" />}
                  iconBg="bg-amber-50"
                  accentBorder="border-r-amber-300"
                  title="الانصراف التلقائي"
                  onEdit={isAdmin ? () => openSection('punchout') : undefined}
                >
                  <PolicyRow
                    label="مهلة الانصراف التلقائي"
                    value={`${policy.auto_punch_out_buffer_minutes ?? DEFAULT_AUTO_PUNCH_OUT_BUFFER_MINUTES} دقيقة`}
                  />
                  {policy.auto_punch_out_rules.length === 0 ? (
                    <div className="flex flex-col items-center py-5 gap-2">
                      <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center">
                        <AlarmClock className="w-5 h-5 text-orange-300" />
                      </div>
                      <p className="text-xs text-gray-400 font-medium">لا توجد قواعد انصراف تلقائي</p>
                    </div>
                  ) : (
                    <div className="space-y-2 mt-2">
                      {policy.auto_punch_out_rules.map((rule) => (
                        <AutoPunchOutRuleCard key={rule.id} rule={rule} />
                      ))}
                    </div>
                  )}
                </PolicyCard>

                <PolicyCard
                  icon={<Timer className="w-4 h-4 text-violet-500" />}
                  iconBg="bg-violet-50"
                  accentBorder="border-r-violet-300"
                  title="العمل الإضافي"
                  onEdit={isAdmin ? () => openSection('overtime') : undefined}
                >
                  <PolicyRow
                    label="الحد الأدنى للعمل الإضافي"
                    value={`${policy.minimum_overtime_minutes ?? DEFAULT_MINIMUM_OVERTIME_MINUTES} دقيقة`}
                  />
                </PolicyCard>

                <PolicyCard
                  icon={<CalendarDays className="w-4 h-4 text-slate-500" />}
                  iconBg="bg-slate-100"
                  accentBorder="border-r-slate-300"
                  title="التنبيهات"
                  onEdit={isAdmin ? () => openSection('rest') : undefined}
                >
                  <PolicyRow
                    label="الحد الأقصى للتأخر قبل التنبيه"
                    value={`${policy.max_late_days_before_warning} أيام`}
                  />
                </PolicyCard>
              </>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <Settings className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>لم يتم تعيين سياسة الحضور بعد</p>
          </div>
        )}
      </div>

      {/* ── Focused mini-modal ──────────────────────────────────────────────────── */}
      {isAdmin && activeSection && editPolicy && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 pb-24"
          onClick={closeSection}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md max-h-[75vh] overflow-y-auto"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white rounded-t-2xl px-5 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between z-10">
              <h2 className="text-gray-800 text-sm font-semibold">{SECTION_TITLES[activeSection]}</h2>
              <button
                type="button"
                onClick={closeSection}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <form className="px-4 py-4 space-y-1" onSubmit={handleSubmit}>

              {/* ── جدول العمل ───────────────────────────────────────────────── */}
              {activeSection === 'schedule' && (
                <>
                  <div className="py-2 border-b border-gray-50">
                    <p className="text-xs text-gray-500 font-medium mb-2">جدول العمل الأسبوعي</p>
                    <WorkScheduleEditor
                      value={editPolicy.work_schedule}
                      onChange={(next) =>
                        setEditPolicy((p) => (p ? { ...p, work_schedule: next } : p))
                      }
                    />
                  </div>
                  <FormRow label="فترة السماح (دقيقة)">
                    <input type="number" className={NUM_INPUT}
                      value={editPolicy.grace_period_minutes}
                      onChange={(e) => setEditPolicy((p) => p ? { ...p, grace_period_minutes: Number(e.target.value) || 0 } : p)}
                    />
                  </FormRow>
                  <FormRow label="وقت قطع الغياب">
                    <input type="time" dir="ltr" className={TIME_INPUT}
                      value={editPolicy.absent_cutoff_time}
                      onChange={(e) => setEditPolicy((p) => p ? { ...p, absent_cutoff_time: e.target.value } : p)}
                    />
                  </FormRow>
                </>
              )}

              {/* ── الانصراف التلقائي ────────────────────────────────────────── */}
              {activeSection === 'punchout' && (
                <>
                  <FormRow label="مهلة الانصراف التلقائي (دقيقة)">
                    <input type="number" className={NUM_INPUT}
                      value={editPolicy.auto_punch_out_buffer_minutes ?? DEFAULT_AUTO_PUNCH_OUT_BUFFER_MINUTES}
                      onChange={(e) => setEditPolicy((p) => p ? { ...p, auto_punch_out_buffer_minutes: Number(e.target.value) || 0 } : p)}
                    />
                  </FormRow>

                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500 font-medium">قواعد الانصراف التلقائي</span>
                      <button
                        type="button"
                        onClick={addRule}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100 px-2.5 py-1 rounded-lg transition-colors font-medium"
                      >
                        <Plus className="w-3 h-3" />
                        إضافة قاعدة
                      </button>
                    </div>

                    {editPolicy.auto_punch_out_rules.length === 0 ? (
                      <div className="flex flex-col items-center py-5 gap-2 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                          <AlarmClock className="w-4.5 h-4.5 text-orange-300" />
                        </div>
                        <p className="text-xs text-gray-400 font-medium">لا توجد قواعد — أضف قاعدة لتحديد أوقات انصراف تلقائية</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {editPolicy.auto_punch_out_rules.map((rule) => (
                          <div key={rule.id} className="bg-gray-50 rounded-xl border border-gray-100 p-3 space-y-1">
                            <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
                              <input
                                type="text"
                                placeholder="عنوان القاعدة..."
                                value={rule.title}
                                onChange={(e) => updateRule(rule.id, { title: e.target.value })}
                                className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 outline-none text-xs font-medium transition-colors"
                              />
                              <button
                                type="button"
                                onClick={() => removeRule(rule.id)}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="flex items-center justify-between py-1 border-b border-gray-100">
                              <span className="text-xs text-gray-500 font-medium">الوقت</span>
                              <input
                                type="time"
                                dir="ltr"
                                value={rule.time}
                                onChange={(e) => updateRule(rule.id, { time: e.target.value })}
                                className={TIME_INPUT}
                              />
                            </div>
                            <div className="flex items-center justify-between py-1 border-b border-gray-100">
                              <span className="text-xs text-gray-500 font-medium">نوع الجلسة</span>
                              <select
                                value={rule.sessionType}
                                onChange={(e) => updateRule(rule.id, { sessionType: e.target.value as AutoPunchOutRule['sessionType'] })}
                                className="w-36 px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 outline-none text-xs font-medium transition-colors"
                              >
                                <option value="all">جميع الجلسات</option>
                                <option value="overtime">العمل الإضافي فقط</option>
                                <option value="regular">الدوام العادي فقط</option>
                              </select>
                            </div>
                            <div className="flex items-center justify-between py-1">
                              <span className="text-xs text-gray-500 font-medium">تفعيل</span>
                              <button
                                type="button"
                                onClick={() => updateRule(rule.id, { enabled: !rule.enabled })}
                                className={`relative inline-flex w-10 h-5 rounded-full transition-colors ${rule.enabled ? 'bg-gray-700' : 'bg-gray-200'}`}
                              >
                                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${rule.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ── العمل الإضافي ─────────────────────────────────────────────── */}
              {activeSection === 'overtime' && (
                <FormRow label="الحد الأدنى للعمل الإضافي (دقيقة)">
                  <input type="number" className={NUM_INPUT}
                    value={editPolicy.minimum_overtime_minutes ?? DEFAULT_MINIMUM_OVERTIME_MINUTES}
                    onChange={(e) => setEditPolicy((p) => p ? { ...p, minimum_overtime_minutes: Number(e.target.value) || 0 } : p)}
                  />
                </FormRow>
              )}

              {/* ── التنبيهات ────────────────────────────────────────────────── */}
              {activeSection === 'rest' && (
                <FormRow label="الحد الأقصى للتأخر قبل التنبيه (أيام)">
                  <input type="number" className={NUM_INPUT}
                    value={editPolicy.max_late_days_before_warning}
                    onChange={(e) => setEditPolicy((p) => p ? { ...p, max_late_days_before_warning: Number(e.target.value) || 0 } : p)}
                  />
                </FormRow>
              )}

              {/* ── سياسة الإجازات ────────────────────────────────────────────── */}
              {activeSection === 'leave' && (
                <FormRow label="الإجازة السنوية (يوم)">
                  <input type="number" className={NUM_INPUT}
                    value={editPolicy.annual_leave_per_year}
                    onChange={(e) => setEditPolicy((p) => p ? { ...p, annual_leave_per_year: Number(e.target.value) || 0 } : p)}
                  />
                </FormRow>
              )}

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={savingPolicy}
                  className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl transition-colors disabled:opacity-50 text-sm font-semibold"
                >
                  {savingPolicy ? 'جاري الحفظ...' : 'حفظ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </PageLayout>
  );
}
