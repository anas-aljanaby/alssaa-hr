import React from 'react';
import { Calendar, Clock, MessageSquare, UserCheck } from 'lucide-react';
import type { Profile } from '@/lib/services/profiles.service';
import type { OvertimeRequestWithSessionAndReviewer } from '@/lib/services/overtime-requests.service';
import { getStatusAr } from '../../data/mockData';

interface OvertimeRequestCardProps {
  request: OvertimeRequestWithSessionAndReviewer;
  profilesMap?: Map<string, Profile>;
  onUserClick?: (userId: string) => void;
  onApprove?: () => void;
  onReject?: () => void;
  showApproverInfo?: boolean;
  approverLabel?: string;
  decidedAtLabel?: string;
}

function StatusPill({ status }: { status: 'pending' | 'approved' | 'rejected' }) {
  const classes =
    status === 'pending'
      ? 'bg-amber-100 text-amber-700'
      : status === 'approved'
        ? 'bg-emerald-100 text-emerald-700'
        : 'bg-red-100 text-red-700';
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs ${classes}`}>{getStatusAr(status)}</span>
  );
}

export function OvertimeRequestCard({
  request,
  profilesMap,
  onUserClick,
  onApprove,
  onReject,
  showApproverInfo = true,
  approverLabel = 'تمت المراجعة بواسطة:',
  decidedAtLabel = 'وقت التحديث:',
}: OvertimeRequestCardProps) {
  const user = profilesMap?.get(request.user_id);
  const session = request.attendance_sessions;

  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm border-r-4 border-r-violet-400">
      {user && (
        <div className="flex items-start justify-between mb-3">
          <button
            type="button"
            className="flex items-center gap-3 text-right focus:outline-none"
            onClick={onUserClick ? () => onUserClick(user.id) : undefined}
          >
            <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center">
              <span className="text-sm text-violet-600">{user.name_ar?.charAt(0) ?? '?'}</span>
            </div>
            <div>
              <p className="text-sm text-gray-800">{user.name_ar ?? '—'}</p>
              <p className="text-xs text-gray-500">{user.employee_id}</p>
            </div>
          </button>
          <StatusPill status={request.status} />
        </div>
      )}

      {!user && (
        <div className="flex items-start justify-between mb-2">
          <span className="text-sm font-medium text-violet-700">طلب عمل إضافي</span>
          <StatusPill status={request.status} />
        </div>
      )}

      <div className="bg-gray-50 rounded-xl p-3 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-lg">
            عمل إضافي (حضور)
          </span>
        </div>
        {session ? (
          <div className="space-y-2 text-xs text-gray-600">
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>التاريخ: {session.date}</span>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <Clock className="w-3.5 h-3.5" />
              <span>
                من {session.check_in_time} إلى {session.check_out_time ?? '—'}
              </span>
              {session.duration_minutes != null && (
                <span className="text-gray-500">
                  ({session.duration_minutes} دقيقة)
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-500">جلسة الحضور غير متاحة</p>
        )}
        {request.note && request.status === 'pending' && (
          <p className="text-sm text-gray-600 mt-2 pt-2 border-t border-gray-200">{request.note}</p>
        )}
      </div>

      {request.note && request.status !== 'pending' && (
        <div
          className={`text-sm p-2.5 rounded-xl mb-3 ${
            request.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          <div className="flex items-center gap-1 mb-1">
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="text-xs opacity-70">ملاحظة المراجعة:</span>
          </div>
          {request.note}
        </div>
      )}

      {showApproverInfo &&
        request.status !== 'pending' &&
        request.reviewer_profile && (
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 mb-3 text-xs text-slate-700">
            <div className="flex items-center gap-1.5 mb-1">
              <UserCheck className="w-3.5 h-3.5" />
              <span className="opacity-70">{approverLabel}</span>
              <span>
                {request.reviewer_profile.name_ar}
                {request.reviewer_profile.employee_id
                  ? ` (${request.reviewer_profile.employee_id})`
                  : ''}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span className="opacity-70">{decidedAtLabel}</span>
              <span>{new Date(request.updated_at).toLocaleString('ar-IQ')}</span>
            </div>
          </div>
        )}

      {onApprove && onReject && request.status === 'pending' && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onApprove}
            className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl flex items-center justify-center gap-1.5 transition-colors"
          >
            الموافقة
          </button>
          <button
            type="button"
            onClick={onReject}
            className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl flex items-center justify-center gap-1.5 transition-colors"
          >
            الرفض
          </button>
        </div>
      )}

      <div className="text-xs text-gray-400 mt-2">
        تم الإنشاء:{' '}
        {new Date(request.created_at).toLocaleDateString('ar-IQ', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </div>
    </div>
  );
}
