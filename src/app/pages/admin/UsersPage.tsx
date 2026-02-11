import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { users, departments, getDepartmentById, type User, type UserRole } from '../../data/mockData';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Shield,
  Users as UsersIcon,
  User as UserIcon,
  Filter,
  Building2,
  BadgeCheck,
} from 'lucide-react';

export function UsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const navigate = useNavigate();

  const filteredUsers = users
    .filter(u => {
      const matchesSearch = u.nameAr.includes(searchQuery) || u.email.includes(searchQuery) || u.employeeId.includes(searchQuery);
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });

  const roleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'مدير عام';
      case 'manager': return 'مدير قسم';
      case 'employee': return 'موظف';
      default: return role;
    }
  };

  const roleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-700';
      case 'manager': return 'bg-emerald-100 text-emerald-700';
      case 'employee': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const roleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield className="w-4 h-4" />;
      case 'manager': return <UsersIcon className="w-4 h-4" />;
      default: return <UserIcon className="w-4 h-4" />;
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-gray-800">إدارة المستخدمين</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          إضافة
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="بحث بالاسم أو البريد أو الرقم الوظيفي..."
          className="w-full pr-10 pl-4 py-3 border border-gray-200 rounded-xl bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {/* Role Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(['all', 'employee', 'manager', 'admin'] as const).map(role => (
          <button
            key={role}
            onClick={() => setRoleFilter(role)}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
              roleFilter === role
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {role === 'all' ? 'الكل' : roleLabel(role)}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
          <p className="text-xl text-blue-700">{users.filter(u => u.role === 'employee').length}</p>
          <p className="text-xs text-gray-500">موظفون</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
          <p className="text-xl text-emerald-700">{users.filter(u => u.role === 'manager').length}</p>
          <p className="text-xs text-gray-500">مديرون</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-3 text-center border border-purple-100">
          <p className="text-xl text-purple-700">{users.filter(u => u.role === 'admin').length}</p>
          <p className="text-xs text-gray-500">إداريون</p>
        </div>
      </div>

      {/* Users List */}
      <div className="space-y-2">
        {filteredUsers.map(user => {
          const dept = getDepartmentById(user.departmentId);
          return (
            <div key={user.uid} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              {/* Clickable area for user card */}
              <div
                onClick={() => navigate(`/user-details/${user.uid}`)}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate(`/user-details/${user.uid}`); }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center ${
                      user.role === 'admin' ? 'bg-purple-100' : user.role === 'manager' ? 'bg-emerald-100' : 'bg-blue-100'
                    }`}>
                      <span className={`text-sm ${
                        user.role === 'admin' ? 'text-purple-600' : user.role === 'manager' ? 'text-emerald-600' : 'text-blue-600'
                      }`}>{user.nameAr.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-800">{user.nameAr}</p>
                      <p className="text-xs text-gray-500 mt-0.5" dir="ltr">{user.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 ${roleColor(user.role)}`}>
                          {roleIcon(user.role)}
                          {roleLabel(user.role)}
                        </span>
                        {dept && (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Building2 className="w-3 h-3" />
                            {dept.nameAr}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <div
                      onClick={() => setEditingUser(user)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                      role="button"
                      tabIndex={0}
                    >
                      <Edit2 className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="p-2 hover:bg-red-50 rounded-lg transition-colors cursor-pointer" role="button" tabIndex={0}>
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                  <span className="text-xs text-gray-400">{user.employeeId}</span>
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${user.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <span className="text-xs text-gray-400">{user.status === 'active' ? 'نشط' : 'غير نشط'}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add User Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={() => setShowForm(false)}>
          <div
            className="bg-white rounded-t-3xl w-full max-w-lg mx-auto p-6 max-h-[85vh] overflow-auto"
            dir="rtl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-gray-800">إضافة مستخدم جديد</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form className="space-y-4" onSubmit={e => { e.preventDefault(); setShowForm(false); }}>
              <div>
                <label className="block mb-1.5 text-gray-700">الاسم الكامل</label>
                <input
                  type="text"
                  placeholder="أدخل الاسم الكامل"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block mb-1.5 text-gray-700">البريد الإلكتروني</label>
                <input
                  type="email"
                  placeholder="example@alssaa.tv"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block mb-1.5 text-gray-700">رقم الهاتف</label>
                <input
                  type="tel"
                  placeholder="+964 770 000 0000"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  dir="ltr"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1.5 text-gray-700">الدور</label>
                  <select className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                    <option value="employee">موظف</option>
                    <option value="manager">مدير قسم</option>
                    <option value="admin">مدير عام</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1.5 text-gray-700">القسم</label>
                  <select className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.nameAr}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
              >
                إضافة المستخدم
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}