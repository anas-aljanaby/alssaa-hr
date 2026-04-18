import { CircleMinus, Info, RefreshCw } from 'lucide-react';
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
  forceReleaseLabel?: string;
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
  forceReleaseLabel = 'إلغاء الوسم',
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
  const holderDepartment = holderProfile?.department?.name_ar ?? 'بدون قسم';

  if (loading) {
    return (
      <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-blue-50 p-4 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-4 w-24 rounded bg-sky-200" />
              <div className="h-3 w-20 rounded bg-sky-100" />
            </div>
            <div className="h-12 w-12 rounded-2xl bg-sky-100" />
          </div>
          <div className="h-16 rounded-2xl bg-white/80" />
          <div className="h-10 rounded-xl bg-sky-100" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-blue-50 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sky-950">وسم الناشر</h3>
            <p className="mt-1 text-sm text-red-600">{loadError}</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
            <PublisherIcon size={20} className="text-sky-700" />
          </div>
        </div>
        {onRetry && (
          <Button
            type="button"
            variant="outline"
            onClick={onRetry}
            className="mt-4 w-full border-sky-200 bg-white text-sky-700 hover:bg-sky-50"
          >
            <RefreshCw className="h-4 w-4" />
            إعادة المحاولة
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-blue-50 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sky-950">وسم الناشر</h3>
          <p className="mt-1 text-sm text-sky-700">الناشر الحالي</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100">
          <PublisherIcon size={20} className="text-sky-700" />
        </div>
      </div>

      {isClaimed ? (
        <div className="publisher-live-row relative mt-4 overflow-hidden rounded-2xl border border-sky-100 bg-white/80 p-3">
          <div className="relative z-10 flex items-center gap-3">
            <Avatar className="h-12 w-12 border border-sky-200">
              {holderProfile.avatar_url && (
              <AvatarImage src={holderProfile.avatar_url} alt={holderName} />
              )}
              <AvatarFallback className="bg-sky-100 text-sky-700">
                {getInitials(holderName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-sky-950">{holderName}</p>
              <p className="mt-1 text-xs text-sky-700">القسم الحالي: {holderDepartment}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-sky-200 bg-white/80 px-4 py-5 text-center text-sm text-sky-700">
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
            <>
              <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-800">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>أنت تحمل الوسم الآن. عند التنازل عنه سيصبح متاحاً لباقي الموظفين.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={onRelease}
                disabled={Boolean(actionLoading)}
                className="w-full border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:text-amber-900"
              >
                <CircleMinus className="h-4 w-4" />
                التنازل عن الوسم
              </Button>
            </>
          )}

          {showForceRelease && isClaimed && (
            <Button
              type="button"
              variant="destructive"
              onClick={onForceRelease}
              disabled={Boolean(actionLoading)}
              className="w-full"
            >
              {forceReleaseLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
