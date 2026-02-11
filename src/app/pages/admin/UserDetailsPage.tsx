import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import {
  getUserById,
  getDepartmentById,
  canAccessUserDetails,
  getTodayAttendance,
  getUserMonthlyStats,
  getUserLeaveBalance,
  getUserRequests,
  getUserAttendanceInRange,
  getRequestTypeAr,
  getStatusAr,
  getAttendanceStatusAr,
  calculateLateMinutes,
  getUserLastActivity,
  auditLogs,
  type RequestStatus,
} from '../../data/mockData';
import {
  ArrowLeft,
  Mail,
  Phone,
  MessageCircle,
  Calendar,
  Clock,
  TrendingUp,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Shield,
  Users,
  User as UserIcon,
  Building2,
  Edit2,
  MoreVertical,
  FileText,
  History,
} from 'lucide-react';

export function UserDetailsPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'leaves' | 'requests'>('overview');
  const [requestFilter, setRequestFilter] = useState<'all' | RequestStatus>('all');
  const [showAuditLog, setShowAuditLog] = useState(false);
  
  // Date range for attendance (default: current month)
  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [dateTo, setDateTo] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });

  if (!currentUser || !userId) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="bg-red-50 rounded-xl p-6 text-center border border-red-100">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-red-800">خطأ في تحميل البيانات</p>
          <button
            onClick={() => navigate('/users')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700"
          >
            العودة للمستخدمين
          </button>
        </div>
      </div>
    );
  }

  // Check access
  if (!canAccessUserDetails(currentUser, userId)) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="bg-amber-50 rounded-xl p-6 text-center border border-amber-100">
          <Shield className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="text-gray-800 mb-2">غير مصرح</h2>
          <p className="text-amber-800 text-sm mb-4">ليس لديك صلاحية لعرض تفاصيل هذا الموظف</p>
          <button
            onClick={() => navigate('/users')}
            className="px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700"
          >
            العودة
          </button>
        </div>
      </div>
    );
  }

  const user = getUserById(userId);
  if (!user) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="bg-gray-50 rounded-xl p-6 text-center border border-gray-100">
          <p className="text-gray-600">الموظف غير موجود</p>
          <button
            onClick={() => navigate('/users')}
            className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-xl hover:bg-gray-700"
          >
            العودة
          </button>
        </div>
      </div>
    );
  }

  const department = getDepartmentById(user.departmentId);
  const todayLog = getTodayAttendance(userId);
  const monthlyStats = getUserMonthlyStats(userId, new Date().getFullYear(), new Date().getMonth());
  const leaveBalance = getUserLeaveBalance(userId);
  const requests = getUserRequests(userId);
  const attendanceLogs = getUserAttendanceInRange(userId, dateFrom, dateTo);
  const lastActivity = getUserLastActivity(userId);
  const userAuditLogs = auditLogs.filter(log => log.targetId === userId || log.actorId === userId).slice(0, 10);

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
      case 'manager': return <Users className="w-4 h-4" />;
      default: return <UserIcon className="w-4 h-4" />;
    }
  };

  const statusColor = (status: RequestStatus) => {
    switch (status) {
      case 'approved': return 'bg-emerald-100 text-emerald-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      case 'pending': return 'bg-amber-100 text-amber-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredRequests = requestFilter === 'all' ? requests : requests.filter(r => r.status === requestFilter);

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 pb-20">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/users')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-gray-800">تفاصيل الموظف</h1>
        </div>
        {currentUser.role === 'admin' && (
          <div className="flex gap-1">
            <button
              onClick={() => setShowAuditLog(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <History className="w-5 h-5 text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Edit2 className="w-5 h-5 text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <MoreVertical className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        )}
      </div>

      {/* Profile Header Card */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-start gap-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl ${
            user.role === 'admin' ? 'bg-purple-100 text-purple-600' : 
            user.role === 'manager' ? 'bg-emerald-100 text-emerald-600' : 
            'bg-blue-100 text-blue-600'
          }`}>
            {user.nameAr.charAt(0)}
          </div>
          <div className="flex-1">
            <h2 className="text-gray-800">{user.nameAr}</h2>
            <p className="text-xs text-gray-500 mt-0.5" dir="ltr">{user.employeeId}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 ${roleColor(user.role)}`}>
                {roleIcon(user.role)}
                {roleLabel(user.role)}
              </span>
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${user.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <span className="text-xs text-gray-500">{user.status === 'active' ? 'نشط' : 'غير نشط'}</span>
              </div>
            </div>
            {department && (
              <div className="flex items-center gap-1 mt-2 text-xs text-gray-600">
                <Building2 className="w-3.5 h-3.5" />
                {department.nameAr}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-100">
          <button className="flex flex-col items-center gap-1 p-2 hover:bg-gray-50 rounded-lg transition-colors">
            <Phone className="w-5 h-5 text-blue-600" />
            <span className="text-xs text-gray-600">اتصال</span>
          </button>
          <button className="flex flex-col items-center gap-1 p-2 hover:bg-gray-50 rounded-lg transition-colors">
            <Mail className="w-5 h-5 text-blue-600" />
            <span className="text-xs text-gray-600">بريد</span>
          </button>
          <button className="flex flex-col items-center gap-1 p-2 hover:bg-gray-50 rounded-lg transition-colors">
            <MessageCircle className="w-5 h-5 text-blue-600" />
            <span className="text-xs text-gray-600">رسالة</span>
          </button>
        </div>

        {/* Last Activity */}
        {lastActivity && (
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
            {lastActivity.lastCheckIn && (
              <div className="flex items-center justify-between">
                <span>آخر تسجيل دخول:</span>
                <span dir="ltr">{lastActivity.lastCheckIn}</span>
              </div>
            )}
            {lastActivity.lastCheckOut && (
              <div className="flex items-center justify-between mt-1">
                <span>آخر تسجيل خروج:</span>
                <span dir="ltr">{lastActivity.lastCheckOut}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl p-1 border border-gray-100 shadow-sm">
        <div className="grid grid-cols-4 gap-1">
          {[
            { key: 'overview', label: 'نظرة عامة' },
            { key: 'attendance', label: 'الحضور' },
            { key: 'leaves', label: 'الإجازات' },
            { key: 'requests', label: 'الطلبات' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-3 py-2 rounded-xl text-sm transition-colors ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-3">
          {/* Today Status */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <h3 className="text-sm text-gray-600 mb-3">حالة اليوم</h3>
            {todayLog ? (
              <div className={`p-3 rounded-xl ${
                todayLog.status === 'present' ? 'bg-emerald-50 border border-emerald-100' :
                todayLog.status === 'late' ? 'bg-amber-50 border border-amber-100' :
                todayLog.status === 'on_leave' ? 'bg-blue-50 border border-blue-100' :
                'bg-red-50 border border-red-100'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${
                    todayLog.status === 'present' ? 'text-emerald-700' :
                    todayLog.status === 'late' ? 'text-amber-700' :
                    todayLog.status === 'on_leave' ? 'text-blue-700' :
                    'text-red-700'
                  }`}>{getAttendanceStatusAr(todayLog.status)}</span>
                  {todayLog.checkInTime && (
                    <span className="text-xs text-gray-600" dir="ltr">
                      دخول: {todayLog.checkInTime}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-2">لا توجد بيانات لليوم</p>
            )}
          </div>

          {/* Monthly Stats */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <h3 className="text-sm text-gray-600 mb-3">إحصائيات الشهر الحالي</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs text-gray-600">أيام الحضور</span>
                </div>
                <p className="text-xl text-emerald-700">{monthlyStats.presentDays}</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span className="text-xs text-gray-600">أيام التأخير</span>
                </div>
                <p className="text-xl text-amber-700">{monthlyStats.lateDays}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                <div className="flex items-center gap-2 mb-1">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="text-xs text-gray-600">أيام الغياب</span>
                </div>
                <p className="text-xl text-red-700">{monthlyStats.absentDays}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span className="text-xs text-gray-600">أيام الإجازة</span>
                </div>
                <p className="text-xl text-blue-700">{monthlyStats.leaveDays}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">مجموع دقائق التأخير</span>
                <span className="text-sm text-amber-700">{monthlyStats.totalLateMinutes} دقيقة</span>
              </div>
            </div>
          </div>

          {/* Leave Balance */}
          {leaveBalance && (
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <h3 className="text-sm text-gray-600 mb-3">رصيد الإجازات</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-600">إجازة اعتيادية</span>
                    <span className="text-sm text-blue-700">{leaveBalance.remainingAnnual} متبقي</span>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <span className="text-gray-500">الكلي: {leaveBalance.totalAnnual}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-500">المستخدم: {leaveBalance.usedAnnual}</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-600">إجازة مرضية</span>
                    <span className="text-sm text-emerald-700">{leaveBalance.remainingSick} متبقي</span>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <span className="text-gray-500">الكلي: {leaveBalance.totalSick}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-500">المستخدم: {leaveBalance.usedSick}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Attendance Tab */}
      {activeTab === 'attendance' && (
        <div className="space-y-3">
          {/* Date Range Picker */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">من</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">إلى</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          {/* Attendance List */}
          <div className="space-y-2">
            {attendanceLogs.length > 0 ? (
              attendanceLogs.map(log => {
                const lateMinutes = log.checkInTime ? calculateLateMinutes(log.checkInTime) : 0;
                return (
                  <div key={log.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm text-gray-800" dir="ltr">{log.date}</p>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs ${
                          log.status === 'present' ? 'bg-emerald-100 text-emerald-700' :
                          log.status === 'late' ? 'bg-amber-100 text-amber-700' :
                          log.status === 'on_leave' ? 'bg-blue-100 text-blue-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {getAttendanceStatusAr(log.status)}
                        </span>
                      </div>
                      {lateMinutes > 0 && (
                        <span className="text-xs text-amber-600">
                          تأخير {lateMinutes} د
                        </span>
                      )}
                    </div>
                    {(log.checkInTime || log.checkOutTime) && (
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-gray-500">الدخول:</span>
                          <span className="text-gray-700 mr-2" dir="ltr">{log.checkInTime || '—'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">الخروج:</span>
                          <span className="text-gray-700 mr-2" dir="ltr">{log.checkOutTime || '—'}</span>
                        </div>
                      </div>
                    )}
                    {log.checkInLocation && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                        <MapPin className="w-3 h-3" />
                        <span>الموقع: متوفر</span>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="bg-gray-50 rounded-xl p-8 text-center border border-gray-100">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">لا توجد سجلات حضور ضمن هذا النطاق</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Leaves Tab */}
      {activeTab === 'leaves' && (
        <div className="space-y-3">
          {/* Balance Cards */}
          {leaveBalance && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <h4 className="text-xs text-gray-600 mb-2">إجازة اعتيادية</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">الكلي:</span>
                    <span className="text-blue-700">{leaveBalance.totalAnnual}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">المستخدم:</span>
                    <span className="text-blue-700">{leaveBalance.usedAnnual}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-blue-200">
                    <span className="text-gray-600">المتبقي:</span>
                    <span className="text-blue-800">{leaveBalance.remainingAnnual}</span>
                  </div>
                </div>
              </div>
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                <h4 className="text-xs text-gray-600 mb-2">إجازة مرضية</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">الكلي:</span>
                    <span className="text-emerald-700">{leaveBalance.totalSick}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">المستخدم:</span>
                    <span className="text-emerald-700">{leaveBalance.usedSick}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-emerald-200">
                    <span className="text-gray-600">المتبقي:</span>
                    <span className="text-emerald-800">{leaveBalance.remainingSick}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Leave Requests */}
          <div className="space-y-2">
            <h3 className="text-sm text-gray-700">سجل الإجازات</h3>
            {requests.filter(r => r.type === 'annual_leave' || r.type === 'sick_leave').length > 0 ? (
              requests
                .filter(r => r.type === 'annual_leave' || r.type === 'sick_leave')
                .map(req => (
                  <div key={req.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="text-xs text-gray-600">{getRequestTypeAr(req.type)}</span>
                        <span className={`inline-block mr-2 px-2 py-0.5 rounded-full text-xs ${statusColor(req.status)}`}>
                          {getStatusAr(req.status)}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 space-y-1">
                      <div>من: {new Date(req.fromDateTime).toLocaleDateString('ar-IQ')}</div>
                      <div>إلى: {new Date(req.toDateTime).toLocaleDateString('ar-IQ')}</div>
                      {req.note && <div className="text-gray-500 italic">"{req.note}"</div>}
                      {req.decisionNote && (
                        <div className="mt-2 pt-2 border-t border-gray-100 text-gray-700">
                          <span className="text-gray-500">القرار: </span>
                          {req.decisionNote}
                        </div>
                      )}
                    </div>
                  </div>
                ))
            ) : (
              <div className="bg-gray-50 rounded-xl p-6 text-center border border-gray-100">
                <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">لا توجد طلبات إجازات</p>
              </div>
            )}
          </div>

          {/* Admin: Adjust Balance Button */}
          {currentUser.role === 'admin' && (
            <button className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors">
              تعديل رصيد الإجازات
            </button>
          )}
        </div>
      )}

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="bg-white rounded-2xl p-1 border border-gray-100 shadow-sm">
            <div className="flex gap-1 overflow-x-auto">
              {(['all', 'pending', 'approved', 'rejected'] as const).map(filter => (
                <button
                  key={filter}
                  onClick={() => setRequestFilter(filter)}
                  className={`px-4 py-2 rounded-xl text-xs whitespace-nowrap transition-colors ${
                    requestFilter === filter
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {filter === 'all' ? 'الكل' : getStatusAr(filter)}
                </button>
              ))}
            </div>
          </div>

          {/* Requests List */}
          <div className="space-y-2">
            {filteredRequests.length > 0 ? (
              filteredRequests.map(req => (
                <div key={req.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm text-gray-800">{getRequestTypeAr(req.type)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(req.createdAt).toLocaleString('ar-IQ')}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs ${statusColor(req.status)}`}>
                      {getStatusAr(req.status)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 space-y-1">
                    <div>من: {new Date(req.fromDateTime).toLocaleString('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                    <div>إلى: {new Date(req.toDateTime).toLocaleString('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                    {req.note && (
                      <div className="mt-2 p-2 bg-gray-50 rounded-lg text-gray-700">
                        {req.note}
                      </div>
                    )}
                    {req.decisionNote && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <span className="text-gray-500">ملاحظة القرار: </span>
                        <span className="text-gray-700">{req.decisionNote}</span>
                      </div>
                    )}
                  </div>
                  {currentUser.role !== 'employee' && req.status === 'pending' && (
                    <div className="flex gap-2 mt-3">
                      <button className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs transition-colors">
                        قبول
                      </button>
                      <button className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs transition-colors">
                        رفض
                      </button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="bg-gray-50 rounded-xl p-8 text-center border border-gray-100">
                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">لا توجد طلبات</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audit Log Modal (Admin Only) */}
      {showAuditLog && currentUser.role === 'admin' && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={() => setShowAuditLog(false)}>
          <div
            className="bg-white rounded-t-3xl w-full max-w-lg mx-auto p-6 max-h-[80vh] overflow-auto"
            dir="rtl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-gray-800">سجل التغييرات</h2>
              <button onClick={() => setShowAuditLog(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <XCircle className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-2">
              {userAuditLogs.length > 0 ? (
                userAuditLogs.map(log => (
                  <div key={log.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <p className="text-sm text-gray-800">{log.actionAr}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(log.timestamp).toLocaleString('ar-IQ')}
                    </p>
                    {log.details && (
                      <p className="text-xs text-gray-600 mt-2">{log.details}</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">لا توجد سجلات</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
