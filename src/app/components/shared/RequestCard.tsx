import React from 'react';
import { Calendar, Download, MessageSquare, Paperclip, UserCheck } from 'lucide-react';
import type { LeaveRequest } from '@/lib/services/requests.service';
import type { Profile } from '@/lib/services/profiles.service';
import { getRequestTypeAr, getStatusAr } from '../../data/mockData';
import * as storageService from '@/lib/services/storage.service';
import { toast } from 'sonner';

interface RequestCardProps {
  request: LeaveRequest;
  /**
   * Optional map of user profiles, used in approvals view to show requester info.
   */
  profilesMap?: Map<string, Profile>;
  /**
   * Optional handler when clicking on the requester user (avatar/name).
   */
  onUserClick?: (userId: string) => void;
  /**
   * Called when approve is clicked (approvals view).
   */
  onApprove?: () => void;
  /**
   * Called when reject is clicked (approvals view).
   */
  onReject?: () => void;
  /**
   * Whether to show the decision note block (when present).
   */
  showDecisionNote?: boolean;
  /**
   * Optional label shown for decision note header.
   */
  decisionNoteLabel?: string;
  /**
   * Whether to show approver details and decision time when available.
   */
  showApproverInfo?: boolean;
  approverLabel?: string;
  decidedAtLabel?: string;
}

export function RequestCard({
  request,
  profilesMap,
  onApprove,
  onReject,
  showDecisionNote = true,
  decisionNoteLabel = 'ملاحظة القرار:',
  onUserClick,
  showApproverInfo = true,
  approverLabel = 'تمت المراجعة بواسطة:',
  decidedAtLabel = 'وقت القرار:',
}: RequestCardProps) {
  const requestWithMeta = request as LeaveRequest & {
    approver_profile?: { id: string; name_ar: string } | null;
    decided_at?: string | null;
  };
  const user = profilesMap?.get(request.user_id);

  const openAttachment = async () => {
    if (!request.attachment_url) return;
    try {
      const url = await storageService.getAttachmentUrl(request.attachment_url);
      window.open(url, '_blank');
    } catch {
      toast.error('فشل فتح المرفق');
    }
  };

  const isTimeAdjustment = request.type === 'time_adjustment';

  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
      {user && (
        <div className="flex items-start justify-between mb-3">
          <button
            type="button"
            className="flex items-center gap-3 text-right focus:outline-none"
            onClick={onUserClick ? () => onUserClick(user.id) : undefined}
          >
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-sm text-blue-600">
                {user.name_ar?.charAt(0) ?? '?'}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-800">{user.name_ar ?? '—'}</p>
            </div>
          </button>
          <StatusPill status={request.status} />
        </div>
      )}

      {!user && (
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <StatusIcon status={request.status} />
            <span className="text-gray-800">{getRequestTypeAr(request.type)}</span>
          </div>
          <StatusPill status={request.status} />
        </div>
      )}

      <div className="bg-gray-50 rounded-xl p-3 mb-3">
        {!user && (
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-blue-600">
              {getRequestTypeAr(request.type)}
            </span>
          </div>
        )}
        <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
          {isTimeAdjustment ? (
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {new Date(request.from_date_time).toLocaleDateString('ar-IQ')}
                {' — '}
                {new Date(request.from_date_time).toLocaleTimeString('ar-IQ', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  من:{' '}
                  {new Date(request.from_date_time).toLocaleDateString('ar-IQ')}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  إلى:{' '}
                  {new Date(request.to_date_time).toLocaleDateString('ar-IQ')}
                </span>
              </div>
            </>
          )}
        </div>
        {request.note && (
          <p className="text-sm text-gray-600 mt-2 pt-2 border-t border-gray-200">
            {request.note}
          </p>
        )}
        {request.attachment_url && (
          <button
            type="button"
            onClick={openAttachment}
            className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg px-2.5 py-1.5 mt-2 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <Paperclip className="w-3 h-3" />
            عرض المرفق
          </button>
        )}
      </div>

      {showDecisionNote && request.decision_note && (
        <div
          className={`text-sm p-2.5 rounded-xl mb-3 ${
            request.status === 'approved'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-red-50 text-red-700'
          }`}
        >
          <div className="flex items-center gap-1 mb-1">
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="text-xs opacity-70">{decisionNoteLabel}</span>
          </div>
          {request.decision_note}
        </div>
      )}

      {showApproverInfo &&
        request.status !== 'pending' &&
        (requestWithMeta.approver_profile || requestWithMeta.decided_at) && (
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 mb-3 text-xs text-slate-700">
            {requestWithMeta.approver_profile && (
              <div className="flex items-center gap-1.5 mb-1">
                <UserCheck className="w-3.5 h-3.5" />
                <span className="opacity-70">{approverLabel}</span>
                <span>{requestWithMeta.approver_profile.name_ar}</span>
              </div>
            )}
            {requestWithMeta.decided_at && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span className="opacity-70">{decidedAtLabel}</span>
                <span>{new Date(requestWithMeta.decided_at).toLocaleString('ar-IQ')}</span>
              </div>
            )}
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

function StatusPill({ status }: { status: LeaveRequest['status'] }) {
  const classes =
    status === 'pending'
      ? 'bg-amber-100 text-amber-700'
      : status === 'approved'
        ? 'bg-emerald-100 text-emerald-700'
        : 'bg-red-100 text-red-700';
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs ${classes}`}>
      {getStatusAr(status)}
    </span>
  );
}

function StatusIcon({ status }: { status: LeaveRequest['status'] }) {
  if (status === 'pending') {
    return <Paperclip className="w-4 h-4 text-amber-500" />;
  }
  if (status === 'approved') {
    return <Download className="w-4 h-4 text-emerald-500" />;
  }
  if (status === 'rejected') {
    return <Paperclip className="w-4 h-4 text-red-500" />;
  }
  return null;
}
