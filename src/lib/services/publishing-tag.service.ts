import { supabase } from '../supabase';
import type { Tables, InsertTables } from '../database.types';
import * as auditService from './audit.service';

type PublishingTagHolderRow = Tables<'publishing_tag_holders'>;
type PublishingTagHolderInsert = InsertTables<'publishing_tag_holders'>;
type PublishingTagProfileSummary = Pick<
  Tables<'profiles'>,
  'id' | 'name_ar' | 'avatar_url'
> & {
  department: Pick<Tables<'departments'>, 'name_ar'> | null;
};

const PUBLISHING_TAG_PROFILE_COLUMNS = 'id, name_ar, avatar_url, department:departments(name_ar)';

export type PublishingTagClaimStatus = 'claimed' | 'unclaimed';

export type PublishingTagHolder = PublishingTagHolderRow & {
  claim_status: PublishingTagClaimStatus;
  holder_profile: PublishingTagProfileSummary | null;
  force_released_by_profile: PublishingTagProfileSummary | null;
};

export type PublishingTagChangeEvent = {
  eventType: 'INSERT' | 'UPDATE';
  new: PublishingTagHolderRow;
  old: Partial<PublishingTagHolderRow>;
};

function isPostgresError(error: unknown): error is { code?: string } {
  return typeof error === 'object' && error !== null;
}

function toClaimConflictError(error: unknown): Error {
  if (isPostgresError(error) && error.code === '23505') {
    return new Error('وسم الناشر محجوز حالياً');
  }

  return error instanceof Error ? error : new Error('تعذر تحديث وسم الناشر');
}

async function getPublishingTagProfiles(
  ids: string[]
): Promise<Map<string, PublishingTagProfileSummary>> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (!uniqueIds.length) return new Map();

  const { data, error } = await supabase
    .from('profiles')
    .select(PUBLISHING_TAG_PROFILE_COLUMNS)
    .in('id', uniqueIds);

  if (error) throw error;

  return new Map((data ?? []).map((profile) => [profile.id, profile]));
}

async function getLatestPublishingTagRow(
  orgId: string
): Promise<PublishingTagHolderRow | null> {
  const { data, error } = await supabase
    .from('publishing_tag_holders')
    .select('*')
    .eq('org_id', orgId)
    .order('claimed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function attachPublishingTagProfiles(
  row: PublishingTagHolderRow | null
): Promise<PublishingTagHolder | null> {
  if (!row) return null;

  const profiles = await getPublishingTagProfiles([
    row.user_id ?? '',
    row.force_released_by ?? '',
  ]);

  return {
    ...row,
    claim_status: row.user_id ? 'claimed' : 'unclaimed',
    holder_profile: row.user_id ? profiles.get(row.user_id) ?? null : null,
    force_released_by_profile: row.force_released_by
      ? profiles.get(row.force_released_by) ?? null
      : null,
  };
}

export async function getPublishingTagHolder(
  orgId: string
): Promise<PublishingTagHolder | null> {
  const row = await getLatestPublishingTagRow(orgId);
  return attachPublishingTagProfiles(row);
}

export async function claimPublishingTag(orgId: string, userId: string): Promise<void> {
  const current = await getLatestPublishingTagRow(orgId);

  if (current?.user_id && current.user_id !== userId) {
    throw new Error('وسم الناشر محجوز حالياً');
  }

  if (current?.user_id === userId) {
    return;
  }

  const payload: PublishingTagHolderInsert = {
    org_id: orgId,
    user_id: userId,
    claimed_at: new Date().toISOString(),
    released_at: null,
    force_released_by: null,
    force_released_at: null,
  };

  if (current) {
    const { data, error } = await supabase
      .from('publishing_tag_holders')
      .update(payload)
      .eq('id', current.id)
      .is('user_id', null)
      .select('*')
      .maybeSingle();

    if (error) {
      throw toClaimConflictError(error);
    }

    if (!data) {
      const latest = await getLatestPublishingTagRow(orgId);

      if (latest?.user_id === userId) {
        return;
      }

      if (latest?.user_id && latest.user_id !== userId) {
        throw new Error('وسم الناشر محجوز حالياً');
      }

      throw new Error('تعذر تحديث وسم الناشر');
    }

    return;
  }

  const { error } = await supabase.from('publishing_tag_holders').insert(payload);

  if (error) {
    throw toClaimConflictError(error);
  }
}

export function subscribeToPublishingTag(
  orgId: string,
  onEvent: (event: PublishingTagChangeEvent) => void
): () => void {
  const channel = supabase
    .channel(`publishing_tag_holders:org:${orgId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'publishing_tag_holders',
        filter: `org_id=eq.${orgId}`,
      },
      (payload) =>
        onEvent({
          eventType: 'INSERT',
          new: payload.new as PublishingTagHolderRow,
          old: {},
        })
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'publishing_tag_holders',
        filter: `org_id=eq.${orgId}`,
      },
      (payload) =>
        onEvent({
          eventType: 'UPDATE',
          new: payload.new as PublishingTagHolderRow,
          old: payload.old as Partial<PublishingTagHolderRow>,
        })
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function releasePublishingTag(orgId: string, userId: string): Promise<void> {
  const current = await getLatestPublishingTagRow(orgId);

  if (!current?.user_id || current.user_id !== userId) {
    throw new Error('لا يمكنك التنازل عن وسم لا تملكه');
  }

  const { error } = await supabase
    .from('publishing_tag_holders')
    .update({
      user_id: null,
      released_at: new Date().toISOString(),
      force_released_by: null,
      force_released_at: null,
    })
    .eq('id', current.id)
    .eq('user_id', userId);

  if (error) {
    throw new Error('تعذر التنازل عن وسم الناشر');
  }
}

export async function forceReleasePublishingTag(
  orgId: string,
  adminId: string
): Promise<void> {
  const current = await getLatestPublishingTagRow(orgId);

  if (!current?.user_id) {
    throw new Error('لا يوجد ناشر معين حالياً');
  }

  const profileMap = await getPublishingTagProfiles([current.user_id, adminId]);
  const holderName = profileMap.get(current.user_id)?.name_ar ?? 'المستخدم';
  const adminName = profileMap.get(adminId)?.name_ar ?? 'الإدارة';
  const releasedAt = new Date().toISOString();

  const { error } = await supabase
    .from('publishing_tag_holders')
    .update({
      user_id: null,
      released_at: releasedAt,
      force_released_by: adminId,
      force_released_at: releasedAt,
    })
    .eq('id', current.id)
    .eq('org_id', orgId)
    .eq('user_id', current.user_id);

  if (error) {
    throw new Error('تعذر إلغاء وسم الناشر');
  }

  try {
    await auditService.createAuditLog({
      org_id: orgId,
      actor_id: adminId,
      action: 'publishing_tag_force_released',
      action_ar: 'إلغاء وسم الناشر',
      target_id: current.user_id,
      target_type: 'user',
      details: `تم إلغاء وسم الناشر عن ${holderName} بواسطة ${adminName}`,
    });
  } catch {
    throw new Error('تم إلغاء الوسم لكن تعذر تسجيل العملية في السجل');
  }
}
