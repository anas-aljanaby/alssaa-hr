import React, { useState } from 'react';
import { departments, users, getDepartmentEmployees, getUserById } from '../../data/mockData';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  Users,
  Crown,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export function DepartmentsPage() {
  const [expandedDept, setExpandedDept] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

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

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      {/* Header */}
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

      {/* Summary */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-500" />
            <span className="text-gray-700">إجمالي الأقسام</span>
          </div>
          <span className="text-2xl text-blue-600">{departments.length}</span>
        </div>
      </div>

      {/* Departments List */}
      <div className="space-y-3">
        {departments.map((dept, idx) => {
          const employees = getDepartmentEmployees(dept.id);
          const manager = getUserById(dept.managerUid);
          const isExpanded = expandedDept === dept.id;
          const colorIdx = idx % deptColors.length;

          return (
            <div key={dept.id} className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden`}>
              <button
                onClick={() => setExpandedDept(isExpanded ? null : dept.id)}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconColors[colorIdx]}`}>
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="text-right">
                    <p className="text-gray-800">{dept.nameAr}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {employees.length} موظف
                      </span>
                      <span className="flex items-center gap-1">
                        <Crown className="w-3 h-3" />
                        {manager?.nameAr}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    onClick={e => { e.stopPropagation(); }}
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
                  <div className="space-y-2">
                    {employees.map(emp => (
                      <div key={emp.uid} className={`flex items-center justify-between p-2.5 rounded-xl ${deptColors[colorIdx]}`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${iconColors[colorIdx]}`}>
                            <span className="text-xs">{emp.nameAr.charAt(0)}</span>
                          </div>
                          <div>
                            <p className="text-sm text-gray-800">{emp.nameAr}</p>
                            <p className="text-xs text-gray-500">{emp.employeeId}</p>
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          emp.role === 'manager' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {emp.role === 'manager' ? 'مدير' : 'موظف'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Department Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={() => setShowForm(false)}>
          <div
            className="bg-white rounded-t-3xl w-full max-w-lg mx-auto p-6"
            dir="rtl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-gray-800">إضافة قسم جديد</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form className="space-y-4" onSubmit={e => { e.preventDefault(); setShowForm(false); }}>
              <div>
                <label className="block mb-1.5 text-gray-700">اسم القسم (عربي)</label>
                <input
                  type="text"
                  placeholder="مثال: قسم التصميم"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block mb-1.5 text-gray-700">اسم القسم (إنجليزي)</label>
                <input
                  type="text"
                  placeholder="e.g. Design Department"
                  dir="ltr"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block mb-1.5 text-gray-700">مدير القسم</label>
                <select className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                  {users.filter(u => u.role === 'manager').map(u => (
                    <option key={u.uid} value={u.uid}>{u.nameAr}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
              >
                إضافة القسم
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}