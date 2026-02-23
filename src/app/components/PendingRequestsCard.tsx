import React from 'react';
import { Link } from 'react-router';
import { ClipboardList } from 'lucide-react';
import { getRequestTypeAr } from '../data/mockData';
import type { LeaveRequest } from '@/lib/services/requests.service';
import type { Profile } from '@/lib/services/profiles.service';

interface PendingRequestsCardProps {
  pendingRequests: LeaveRequest[];
  profilesMap: Map<string, Profile>;
  approvalsPath?: string;
}

export function PendingRequestsCard({
  pendingRequests,
  profilesMap,
  approvalsPath = '/approvals',
}: PendingRequestsCardProps) {
  const count = pendingRequests.length;

  return (
    <Link
      to={approvalsPath}
      className="block bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:border-amber-200 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-amber-500" />
          <h3 className="text-gray-800">طلبات بانتظار الموافقة</h3>
        </div>
        <span className="w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs">
          {count}
        </span>
      </div>
      <div className="space-y-2">
        {count === 0 ? (
          <p className="text-sm text-gray-500">لا توجد طلبات معلقة</p>
        ) : (
          pendingRequests.slice(0, 3).map((req) => {
            const user = profilesMap.get(req.user_id);
            return (
              <div key={req.id} className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-800">{user?.name_ar ?? '—'}</span>
                  <span className="text-xs text-amber-600">{getRequestTypeAr(req.type)}</span>
                </div>
                {req.note ? <p className="text-xs text-gray-500 mt-1">{req.note}</p> : null}
              </div>
            );
          })
        )}
      </div>
    </Link>
  );
}
