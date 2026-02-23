import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import * as departmentsService from '@/lib/services/departments.service';
import * as profilesService from '@/lib/services/profiles.service';
import type { Department } from '@/lib/services/departments.service';
import type { Profile } from '@/lib/services/profiles.service';
import {
  Building2,
  Plus,
  Edit2,
  Users,
  Crown,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export function DepartmentsPage() {
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<(Department & { employee_count: number })[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [expandedDept, setExpandedDept] = useState<string | null>(null);
  const [deptEmployees, setDeptEmployees] = useState<Profile[]>([]);
  const [expandLoading, setExpandLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ nameAr: '', nameEn: '', managerId: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [depts, profs] = await Promise.all([
        departmentsService.getDepartmentWithEmployeeCount(),
        profilesService.listUsers(),
      ]);
      setDepartments(depts);
      setAllProfiles(profs);
    } catch {
      toast.error('فشل تحميل الأقسام');
    } finally {
      setLoading(false);
    }
  }

  const profilesMap = useMemo(
    () => new Map(allProfiles.map((p) => [p.id, p])),
    [allProfiles]
  );

  const managers = useMemo(
    () => allProfiles.filter((p) => p.role === 'manager'),
    [allProfiles]
  );

  const handleExpand = async (deptId: string) => {
    if (expandedDept === deptId) {
      setExpandedDept(null);
      return;
    }
    setExpandedDept(deptId);
    setExpandLoading(true);
    try {
      const emps = await profilesService.getDepartmentEmployees(deptId);
      setDeptEmployees(emps);
    } catch {
      toast.error('فشل تحميل الموظفين');
    } finally {
      setExpandLoading(false);
    }
  };

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nameAr || !formData.nameEn) return;
    setSubmitting(true);
    try {
      await departmentsService.createDepartment({
        name: formData.nameEn,
        name_ar: formData.nameAr,
        manager_uid: formData.managerId || null,
      });
      toast.success('تم إضافة القسم بنجاح');
      setShowForm(false);
      setFormData({ nameAr: '', nameEn: '', managerId: '' });
      await loadData();
    } catch {
      toast.error('فشل إضافة القسم');
    } finally {
      setSubmitting(false);
    }
  };

  const deptColors = [
    'bg-blue-50 border-blue-200',
    'bg-emerald-50 border-emerald-200',
    'bg-purple-50 border-purple-200',
    'bg-amber-50 border-amber-200',
    'bg-rose-50 border-rose-200',
  ];

  const iconColors = [
    'bg-blue-100 text-blue-600',
    'bg-emerald-100 text-emerald-600',
    'bg-purple-100 text-purple-600',
    'bg-amber-100 text-amber-600',
    'bg-rose-100 text-rose-600',
  ];

  if (loading) {
    return (
      <div className="p-4 max-w-lg mx-auto space-y-4">
        <div className="bg-gray-100 rounded-2xl h-16 animate-pulse" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-100 rounded-2xl h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-gray-800">إدارة الأقسام</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          قسم جديد
        </button>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-500" />
            <span className="text-gray-700">إجمالي الأقسام</span>
          </div>
          <span className="text-2xl text-blue-600">{departments.length}</span>
        </div>
      </div>

      <div className="space-y-3">
        {departments.map((dept, idx) => {
          const manager = profilesMap.get(dept.manager_uid ?? '');
          const isExpanded = expandedDept === dept.id;
          const colorIdx = idx % deptColors.length;

          return (
            <div
              key={dept.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              <button
                onClick={() => handleExpand(dept.id)}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconColors[colorIdx]}`}
                  >
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="text-right">
                    <p className="text-gray-800">{dept.name_ar}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {dept.employee_count} موظف
                      </span>
                      <span className="flex items-center gap-1">
                        <Crown className="w-3 h-3" />
                        {manager?.name_ar ?? '—'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 hover:bg-gray-100 rounded-lg cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                  <p className="text-xs text-gray-400 mb-2">أعضاء القسم</p>
                  {expandLoading ? (
                    <div className="space-y-2">
                      {[...Array(2)].map((_, i) => (
                        <div key={i} className="bg-gray-100 rounded-xl h-12 animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {deptEmployees.map((emp) => (
                        <div
                          key={emp.id}
                          className={`flex items-center justify-between p-2.5 rounded-xl ${deptColors[colorIdx]}`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center ${iconColors[colorIdx]}`}
                            >
                              <span className="text-xs">{emp.name_ar.charAt(0)}</span>
                            </div>
                            <div>
                              <p className="text-sm text-gray-800">{emp.name_ar}</p>
                              <p className="text-xs text-gray-500">{emp.employee_id}</p>
                            </div>
                          </div>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              emp.role === 'manager'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {emp.role === 'manager' ? 'مدير' : 'موظف'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

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
              <h2 className="text-gray-800">إضافة قسم جديد</h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleCreateDept}>
              <div>
                <label className="block mb-1.5 text-gray-700">اسم القسم (عربي)</label>
                <input
                  type="text"
                  value={formData.nameAr}
                  onChange={(e) => setFormData((p) => ({ ...p, nameAr: e.target.value }))}
                  placeholder="مثال: قسم التصميم"
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block mb-1.5 text-gray-700">اسم القسم (إنجليزي)</label>
                <input
                  type="text"
                  value={formData.nameEn}
                  onChange={(e) => setFormData((p) => ({ ...p, nameEn: e.target.value }))}
                  placeholder="e.g. Design Department"
                  required
                  dir="ltr"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block mb-1.5 text-gray-700">مدير القسم</label>
                <select
                  value={formData.managerId}
                  onChange={(e) => setFormData((p) => ({ ...p, managerId: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">-- اختيار --</option>
                  {managers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name_ar}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-colors"
              >
                {submitting ? 'جاري الإضافة...' : 'إضافة القسم'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
