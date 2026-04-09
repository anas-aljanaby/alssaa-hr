import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import * as profilesService from '@/lib/services/profiles.service';
import * as departmentsService from '@/lib/services/departments.service';
import * as attendanceService from '@/lib/services/attendance.service';
import * as requestsService from '@/lib/services/requests.service';
import { useRealtimeSubscription } from '@/lib/hooks/useRealtimeSubscription';
import type { Profile } from '@/lib/services/profiles.service';
import type { Department } from '@/lib/services/departments.service';
import type { TeamAttendanceDayRow } from '@/lib/services/attendance.service';
import type { LeaveRequest } from '@/lib/services/requests.service';
import { AdminDashboardSkeleton } from '../../components/skeletons';
import { PendingRequestsCard } from '../../components/PendingRequestsCard';
import {
  AttendanceCharts,
} from '../../components/dashboard';
import {
  CheckCircle2,
  Timer,
  XCircle,
  Coffee,
  Shield,
} from 'lucide-react';
import { DashboardHeader } from '../../components/shared/DashboardHeader';
import { StatCard } from '../../components/shared/StatCard';
import { now } from '@/lib/time';
import { UnavailableState } from '../../components/shared/UnavailableState';
import { isOfflineError } from '@/lib/network';
import {
  DASHBOARD_SUMMARY_CHIPS,
  countByChip,
  getChipsForRole,
  resolveAttendanceDayState,
  resolveAttendanceDisplayStatus,
  getStatusConfig,
  type DisplayStatus,
  type LivePresence,
} from '@/shared/attendance';

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hasJoinedBy(day: string, joinDate: string | null | undefined): boolean {
  if (!joinDate) return true;
  return joinDate <= day;
}

function mapTeamRowLivePresence(row: TeamAttendanceDayRow): LivePresence {
  if (row.isCheckedInNow) return 'checked_in';
  if (row.sessionCount > 0 || !!row.firstCheckIn || !!row.lastCheckOut) return 'checked_out';
  return 'no_session';
}

function resolveTeamRowDisplayStatus(row: TeamAttendanceDayRow, liveMode: boolean): DisplayStatus {
  return resolveAttendanceDisplayStatus(
    {
      ...resolveAttendanceDayState(row.displayStatus),
      hasOvertime: row.hasOvertime,
    },
    liveMode ? mapTeamRowLivePresence(row) : null,
    {
      isWithinShiftWindow: row.displayStatus == null,
    }
  );
}

type AdminTab = 'overview' | 'analytics';
type DashboardSummaryKey = 'present' | 'late' | 'absent' | 'on_leave';

const DASHBOARD_FILTER_BY_SUMMARY_KEY: Record<DashboardSummaryKey, string> = {
  present: 'present_now',
  late: 'late',
  absent: 'absent',
  on_leave: 'on_leave',
};

export function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [todayRows, setTodayRows] = useState<TeamAttendanceDayRow[]>([]);
  const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([]);
  const [weekRows, setWeekRows] = useState<{ day: string; rows: TeamAttendanceDayRow[] }[]>([]);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const handleAttendanceEvent = useCallback(
    (event: attendanceService.AttendanceChangeEvent) => {
      const today = dateStr(now());
      if (event.new.date !== today) return;
      void loadData();
    },
    []
  );

  useRealtimeSubscription(
    () => attendanceService.subscribeToAttendanceLogs(handleAttendanceEvent),
    [handleAttendanceEvent]
  );

  useRealtimeSubscription(
    () =>
      requestsService.subscribeToAllRequests((event) => {
        if (event.eventType === 'INSERT' && event.new.status === 'pending') {
          setPendingRequests((prev) => [event.new, ...prev]);
        } else if (event.eventType === 'UPDATE') {
          setPendingRequests((prev) =>
            event.new.status === 'pending'
              ? prev.map((r) => (r.id === event.new.id ? event.new : r))
              : prev.filter((r) => r.id !== event.new.id)
          );
        }
      }),
    []
  );

  async function loadData() {
    try {
      setLoading(true);
      const today = dateStr(now());
      const [profs, depts, rows, pendingReqs] = await Promise.all([
        profilesService.listUsers(),
        departmentsService.listDepartments(),
        attendanceService.getTeamAttendanceDay({ date: today }),
        requestsService.getAllPendingRequests(),
      ]);
      setLoadError(null);
      setProfiles(profs);
      setDepartments(depts);
      setTodayRows(rows);
      setPendingRequests(pendingReqs);

      const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
      const base = now();
      const weekDays = Array.from({ length: 5 }, (_, idx) => {
        const i = 4 - idx;
        const d = new Date(base);
        d.setDate(d.getDate() - i);
        return d;
      });
      const weekData = await Promise.all(
        weekDays.map(async (d) => {
          const ds = dateStr(d);
          const rowsForDay = await attendanceService.getTeamAttendanceDay({ date: ds });
          return {
            day: days[d.getDay()] || d.toLocaleDateString('ar-IQ', { weekday: 'short' }),
            rows: rowsForDay,
          };
        })
      );
      setWeekRows(weekData);
    } catch (error) {
      const message = isOfflineError(error)
        ? 'تعذر تحميل لوحة المدير العام بدون اتصال بالإنترنت.'
        : 'فشل تحميل البيانات.';
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  const allNonAdmin = useMemo(
    () => profiles.filter((p) => p.role !== 'admin'),
    [profiles]
  );

  const handleSummaryCardClick = useCallback(
    (key: DashboardSummaryKey) => {
      const params = new URLSearchParams({
        mode: 'live',
        date: dateStr(now()),
        filter: DASHBOARD_FILTER_BY_SUMMARY_KEY[key],
      });

      navigate(`/team-attendance?${params.toString()}`);
    },
    [navigate]
  );

  const overallStats = useMemo(() => {
    const today = dateStr(now());
    const activeEmployees = allNonAdmin.filter((e) => hasJoinedBy(today, e.join_date));
    const activeUserIds = new Set(activeEmployees.map((employee) => employee.id));
    const summaryRows = todayRows
      .filter((row) => row.role !== 'admin' && activeUserIds.has(row.userId))
      .map((row) => ({
        ...row,
        displayStatus: resolveTeamRowDisplayStatus(row, true),
      }));
    const visibleSummaryChips = getChipsForRole(DASHBOARD_SUMMARY_CHIPS, 'admin');
    const counts = countByChip(visibleSummaryChips, summaryRows);

    return {
      totalEmployees: activeEmployees.length,
      totalDepartments: departments.length,
      present: counts.present ?? 0,
      late: counts.late ?? 0,
      absent: counts.absent ?? 0,
      onLeave: counts.on_leave ?? 0,
    };
  }, [todayRows, allNonAdmin, departments]);

  const profilesMap = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles]
  );

  const deptChartData = useMemo(() => {
    const today = dateStr(now());
    return departments.map((dept) => {
      const eligibleRows = todayRows
        .filter((row) => row.departmentId === dept.id && row.role !== 'admin')
        .filter((row) => {
          const profile = allNonAdmin.find((person) => person.id === row.userId);
          return profile ? hasJoinedBy(today, profile.join_date) : false;
        })
        .map((row) => resolveTeamRowDisplayStatus(row, true));

      return {
        name: dept.name_ar,
        حاضر: eligibleRows.filter((status) => status === 'present_now' || status === 'finished').length,
        متأخر: eligibleRows.filter((status) => status === 'late_now').length,
        غائب: eligibleRows.filter((status) => status === 'absent' || status === 'not_registered').length,
      };
    });
  }, [departments, allNonAdmin, todayRows]);

  const pieData = useMemo(
    () =>
      [
        { name: 'حاضر', value: overallStats.present, color: '#059669' },
        { name: 'متأخر', value: overallStats.late, color: '#d97706' },
        { name: 'غائب', value: overallStats.absent, color: '#dc2626' },
        { name: 'إجازة', value: overallStats.onLeave, color: '#2563eb' },
      ].filter((d) => d.value > 0),
    [overallStats]
  );

  const weeklyTrend = useMemo(
    () =>
      weekRows.map((w) => ({
        day: w.day,
        حضور: w.rows
          .filter((row) => row.role !== 'admin')
          .map((row) => resolveTeamRowDisplayStatus(row, false))
          .filter((status) => status === 'present').length,
        تأخر: w.rows
          .filter((row) => row.role !== 'admin')
          .map((row) => resolveTeamRowDisplayStatus(row, false))
          .filter((status) => status === 'late').length,
      })),
    [weekRows]
  );

  const summaryCards = useMemo(
    () =>
      getChipsForRole(DASHBOARD_SUMMARY_CHIPS, 'admin').map((chip) => {
        const primaryStatus = chip.matchStatuses[0];
        const config = primaryStatus ? getStatusConfig(primaryStatus) : null;
        return {
          key: chip.key,
          label: chip.label,
          value: overallStats[chip.key === 'on_leave' ? 'onLeave' : chip.key as 'present' | 'late' | 'absent'],
          color: config ? `${config.bgColor} ${config.borderColor}` : 'bg-slate-50 border-slate-200',
          onClick: () => handleSummaryCardClick(chip.key as DashboardSummaryKey),
        };
      }),
    [handleSummaryCardClick, overallStats]
  );

  if (loading) {
    return <AdminDashboardSkeleton />;
  }

  if (loadError) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <UnavailableState
          title="تعذر تحميل لوحة المدير العام"
          description={loadError}
          actionLabel="إعادة المحاولة"
          onAction={() => void loadData()}
        />
      </div>
    );
  }

  const tabClass = (tab: AdminTab) =>
    `px-3 py-2 rounded-xl text-sm transition-colors ${
      activeTab === tab ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-50'
    }`;

  return (
    <div className="mx-auto max-w-lg space-y-3 px-4 pb-24 pt-3">
      <DashboardHeader
        gradientClassName="bg-gradient-to-l from-purple-700 to-indigo-800"
        title="المدير العام"
        helperText="لوحة التحكم الرئيسية"
        subtitle="شبكة الساعة"
        avatar={<Shield className="w-6 h-6" />}
        footer={
          <div className="flex items-center justify-between text-sm">
            <span className="opacity-90">{overallStats.totalEmployees} موظف</span>
            <span className="opacity-90">{overallStats.totalDepartments} قسم</span>
          </div>
        }
      />

      <div className="bg-white rounded-2xl p-1 border border-gray-100 shadow-sm">
        <div className="grid grid-cols-2 gap-1">
          {(['overview', 'analytics'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={tabClass(tab)}
            >
              {tab === 'overview' && 'نظرة عامة'}
              {tab === 'analytics' && 'التحليلات'}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && (
        <>
          <div>
            <h3 className="mb-2 text-gray-800">ملخص اليوم</h3>
            <div className="grid grid-cols-2 gap-3">
              {summaryCards.map((card) => (
                <StatCard
                  key={card.key}
                  icon={
                    card.key === 'present' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : card.key === 'late' ? (
                      <Timer className="w-5 h-5 text-amber-500" />
                    ) : card.key === 'absent' ? (
                      <XCircle className="w-5 h-5 text-red-500" />
                    ) : (
                      <Coffee className="w-5 h-5 text-purple-500" />
                    )
                  }
                  label={card.label}
                  value={card.value}
                  color={card.color}
                  onClick={card.onClick}
                />
              ))}
            </div>
          </div>
          <PendingRequestsCard
            pendingRequests={pendingRequests}
            profilesMap={profilesMap}
          />
        </>
      )}

      {activeTab === 'analytics' && (
        <AttendanceCharts
          pieData={pieData}
          weeklyTrend={weeklyTrend}
          deptChartData={deptChartData}
        />
      )}
    </div>
  );
}
