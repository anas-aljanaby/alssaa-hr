import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import * as publishingTagService from '@/lib/services/publishing-tag.service';
import type { PublishingTagHolder } from '@/lib/services/publishing-tag.service';
import { useRealtimeSubscription } from '@/lib/hooks/useRealtimeSubscription';

type PublishingTagAction = 'claim' | 'release' | 'force-release' | null;

interface UsePublishingTagOptions {
  orgId?: string;
  userId?: string;
}

export function usePublishingTag({ orgId, userId }: UsePublishingTagOptions) {
  const [holder, setHolder] = useState<PublishingTagHolder | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<PublishingTagAction>(null);

  useEffect(() => {
    if (!orgId) {
      setHolder(null);
      setLoadError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    void refresh();
  }, [orgId]);

  useRealtimeSubscription(
    () => {
      if (!orgId) return undefined;
      return publishingTagService.subscribeToPublishingTag(orgId, () => {
        void refresh({ silent: true });
      });
    },
    [orgId]
  );

  async function refresh(options?: { silent?: boolean }) {
    if (!orgId) return;

    const { silent = false } = options ?? {};

    try {
      if (!silent) {
        setLoading(true);
      }
      const nextHolder = await publishingTagService.getPublishingTagHolder(orgId);
      setHolder(nextHolder);
      setLoadError(null);
    } catch (error) {
      console.error('[usePublishingTag] refresh failed', error);
      const message = 'فشل تحميل وسم الناشر';
      setLoadError(message);
      if (!silent) {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function claim() {
    if (!orgId || !userId || actionLoading) return;

    setActionLoading('claim');
    try {
      await publishingTagService.claimPublishingTag(orgId, userId);
      toast.success('تم أخذ وسم الناشر');
      await refresh({ silent: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر أخذ وسم الناشر';
      toast.error(message);
      await refresh({ silent: true });
    } finally {
      setActionLoading(null);
    }
  }

  async function release() {
    if (!orgId || !userId || actionLoading) return;

    setActionLoading('release');
    try {
      await publishingTagService.releasePublishingTag(orgId, userId);
      toast.success('تم التنازل عن وسم الناشر');
      await refresh({ silent: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر التنازل عن وسم الناشر';
      toast.error(message);
      await refresh({ silent: true });
    } finally {
      setActionLoading(null);
    }
  }

  async function forceRelease() {
    if (!orgId || !userId || !holder?.user_id || actionLoading) return;

    const confirmed = window.confirm('هل تريد إلغاء وسم الناشر الحالي؟');
    if (!confirmed) return;

    setActionLoading('force-release');
    try {
      await publishingTagService.forceReleasePublishingTag(orgId, userId);
      toast.success('تم إلغاء وسم الناشر');
      await refresh({ silent: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر إلغاء وسم الناشر';
      toast.error(message);
      await refresh({ silent: true });
    } finally {
      setActionLoading(null);
    }
  }

  return {
    holder,
    loading,
    loadError,
    actionLoading,
    refresh,
    claim,
    release,
    forceRelease,
  };
}
