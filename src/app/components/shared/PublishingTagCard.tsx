import { RefreshCw } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar';
import { Button } from '@/app/components/ui/button';
import { PublisherIcon } from './PublisherIcon';
import type { PublishingTagHolder } from '@/lib/services/publishing-tag.service';

type PublishingTagAction = 'claim' | 'release' | 'force-release' | null;

interface PublishingTagCardProps {
  holder: PublishingTagHolder | null;
  currentUserId?: string;
  loading?: boolean;
  loadError?: string | null;
  actionLoading?: PublishingTagAction;
  showSelfActions?: boolean;
  showForceRelease?: boolean;
  onClaim?: () => void;
  onRelease?: () => void;
  onForceRelease?: () => void;
  onRetry?: () => void;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '؟';
  return name.trim().charAt(0) || '؟';
}

export function PublishingTagCard({
  holder,
  currentUserId,
  loading = false,
  loadError = null,
  actionLoading = null,
  showSelfActions = true,
  showForceRelease = false,
  onClaim,
  onRelease,
  onForceRelease,
  onRetry,
}: PublishingTagCardProps) {
  const isClaimed = holder?.claim_status === 'claimed' && Boolean(holder.user_id);
  const isHeldByCurrentUser = isClaimed && holder?.user_id === currentUserId;
  const isHeldBySomeoneElse = isClaimed && holder?.user_id !== currentUserId;
  const holderProfile = holder?.holder_profile ?? null;
  const holderName = holderProfile?.name_ar ?? 'مستخدم';
  const holderEmployeeId = holderProfile?.employee_id ?? '—';

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-4 w-24 rounded bg-gray-200" />
              <div className="h-3 w-20 rounded bg-gray-100" />
            </div>
            <div className="h-12 w-12 rounded-2xl bg-gray-100" />
          </div>
          <div className="h-16 rounded-2xl bg-gray-50" />
          <div className="h-10 rounded-xl bg-gray-100" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-white rounded-2xl p-4 border border-red-100 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-gray-800">وسم الناشر</h3>
            <p className="mt-1 text-sm text-red-600">{loadError}</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <PublisherIcon size={20} className="text-red-600" />
          </div>
        </div>
        {onRetry && (
          <Button
            type="button"
            variant="outline"
            onClick={onRetry}
            className="mt-4 w-full"
          >
            <RefreshCw className="h-4 w-4" />
            إعادة المحاولة
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-gray-800">وسم الناشر</h3>
          <p className="mt-1 text-sm text-gray-500">الناشر الحالي</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50">
          <PublisherIcon size={20} />
        </div>
      </div>

      {isClaimed ? (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-blue-50/60 p-3">
          <Avatar className="h-12 w-12 border border-blue-100">
            {holderProfile.avatar_url && (
              <AvatarImage src={holderProfile.avatar_url} alt={holderName} />
            )}
            <AvatarFallback className="bg-blue-100 text-blue-700">
              {getInitials(holderName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm text-gray-800">{holderName}</p>
            <p className="mt-1 text-xs text-gray-500">{holderEmployeeId}</p>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-center text-sm text-gray-500">
          لا يوجد ناشر معين حالياً
        </div>
      )}

      {(showSelfActions || (showForceRelease && isClaimed)) && (
        <div className="mt-4 flex flex-col gap-2">
          {showSelfActions && !isHeldByCurrentUser && (
            <Button
              type="button"
              onClick={onClaim}
              disabled={Boolean(actionLoading) || isHeldBySomeoneElse}
              className="w-full bg-blue-600 text-white hover:bg-blue-700"
            >
              أخذ وسم الناشر
            </Button>
          )}

          {showSelfActions && isHeldByCurrentUser && (
            <Button
              type="button"
              variant="outline"
              onClick={onRelease}
              disabled={Boolean(actionLoading)}
              className="w-full"
            >
              التنازل عن الوسم
            </Button>
          )}

          {showForceRelease && isClaimed && (
            <Button
              type="button"
              variant="destructive"
              onClick={onForceRelease}
              disabled={Boolean(actionLoading)}
              className="w-full"
            >
              إلغاء الوسم
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
