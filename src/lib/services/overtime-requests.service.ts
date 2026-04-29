import { supabase } from '../supabase';
import type { Tables } from '../database.types';
import { emitOvertimeRequestDecided } from '@/lib/notifications/emit';

export type OvertimeRequest = Tables<'overtime_requests'>;
export type OvertimeRequestStatus = OvertimeRequest['status'];
export type AttendanceSessionRow = Tables<'attendance_sessions'>;

export type OvertimeRequestWithSession = OvertimeRequest & {
  attendance_sessions: AttendanceSessionRow | null;
};

export type ReviewerProfileSummary = Pick<Tables<'profiles'>, 'id' | 'name_ar' | 'employee_id'>;

export type OvertimeRequestWithSessionAndReviewer = OvertimeRequestWithSession & {
  reviewer_profile?: ReviewerProfileSummary | null;
};
export type ApproverOvertimeRequestOptions = {
  excludeUserId?: string;
};

async function attachReviewerProfiles(
  rows: OvertimeRequestWithSession[]
): Promise<OvertimeRequestWithSessionAndReviewer[]> {
  const reviewerIds = Array.from(
    new Set(
      rows
        .map((r) => r.reviewed_by)
        .filter((id): id is string => Boolean(id))
    )
  );
  if (!reviewerIds.length) {
    return rows.map((r) => ({ ...r, reviewer_profile: null }));
  }
  const { data: reviewers, error } = await supabase
    .from('profiles')
    .select('id, name_ar, employee_id')
    .in('id', reviewerIds);
  if (error) throw error;
  const map = new Map((reviewers ?? []).map((p) => [p.id, p]));
  return rows.map((r) => ({
    ...r,
    reviewer_profile: r.reviewed_by ? map.get(r.reviewed_by) ?? null : null,
  }));
}

const overtimeSelectWithSession = `
  *,
  attendance_sessions (*)
`;

function excludeUserIds(userIds: string[], options?: ApproverOvertimeRequestOptions): string[] {
  if (!options?.excludeUserId) return userIds;
  return userIds.filter((id) => id !== options.excludeUserId);
}

function isReviewableOvertimeRequest(row: OvertimeRequestWithSession): boolean {
  return Boolean(row.attendance_sessions?.check_out_time);
}

function filterApproverOvertimeRequests(
  rows: OvertimeRequestWithSession[],
  options?: ApproverOvertimeRequestOptions
): OvertimeRequestWithSession[] {
  return rows.filter((row) => {
    if (!isReviewableOvertimeRequest(row)) return false;
    if (options?.excludeUserId && row.user_id === options.excludeUserId) return false;
    return true;
  });
}

export async function getOvertimeRequestsForUser(userId: string): Promise<OvertimeRequestWithSessionAndReviewer[]> {
  const { data, error } = await supabase
    .from('overtime_requests')
    .select(overtimeSelectWithSession)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as OvertimeRequestWithSession[];
  return attachReviewerProfiles(rows);
}

export async function getDepartmentOvertimeRequests(
  departmentId: string,
  options?: ApproverOvertimeRequestOptions
): Promise<OvertimeRequestWithSessionAndReviewer[]> {
  const { data: employees, error: empErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('department_id', departmentId);
  if (empErr) throw empErr;
  if (!employees?.length) return [];
  const userIds = excludeUserIds(employees.map((e) => e.id), options);
  if (!userIds.length) return [];
  const { data, error } = await supabase
    .from('overtime_requests')
    .select(overtimeSelectWithSession)
    .in('user_id', userIds)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as OvertimeRequestWithSession[];
  return attachReviewerProfiles(filterApproverOvertimeRequests(rows, options));
}

export async function getAllOvertimeRequests(
  options?: ApproverOvertimeRequestOptions
): Promise<OvertimeRequestWithSessionAndReviewer[]> {
  const { data, error } = await supabase
    .from('overtime_requests')
    .select(overtimeSelectWithSession)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as OvertimeRequestWithSession[];
  return attachReviewerProfiles(filterApproverOvertimeRequests(rows, options));
}

export async function updateOvertimeRequestStatus(
  requestId: string,
  status: OvertimeRequestStatus,
  reviewerId: string,
  decisionNote: string
): Promise<OvertimeRequest> {
  const { data: updatedRows, error } = await supabase
    .from('overtime_requests')
    .update({
      status,
      reviewed_by: reviewerId,
      note: decisionNote || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select();
  if (error) throw error;

  const data = updatedRows?.[0];
  if (!data) {
    throw new Error('لا يمكن تحديث الطلب لأنه لم يعد قيد الانتظار.');
  }

  if (status === 'approved' || status === 'rejected') {
    void emitOvertimeRequestDecided({
      request_id: data.id,
      requester_id: data.user_id,
      status,
      decision_note: data.note,
      actor_id: reviewerId,
    });
  }

  return data;
}

export async function countPendingOvertimeRequests(
  departmentId?: string,
  options?: ApproverOvertimeRequestOptions
): Promise<number> {
  if (departmentId) {
    const { data: employees, error: empErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('department_id', departmentId);
    if (empErr) throw empErr;
    if (!employees?.length) return 0;
    const userIds = excludeUserIds(employees.map((e) => e.id), options);
    if (!userIds.length) return 0;
    const { data, error } = await supabase
      .from('overtime_requests')
      .select(overtimeSelectWithSession)
      .in('user_id', userIds)
      .eq('status', 'pending');
    if (error) throw error;
    const rows = (data ?? []) as unknown as OvertimeRequestWithSession[];
    return filterApproverOvertimeRequests(rows, options).length;
  }
  const { data, error } = await supabase
    .from('overtime_requests')
    .select(overtimeSelectWithSession)
    .eq('status', 'pending');
  if (error) throw error;
  const rows = (data ?? []) as unknown as OvertimeRequestWithSession[];
  return filterApproverOvertimeRequests(rows, options).length;
}

export type OvertimeRequestChangeEvent = {
  eventType: 'INSERT' | 'UPDATE';
  new: OvertimeRequest;
  old: Partial<OvertimeRequest>;
};

export function subscribeToUserOvertimeRequests(
  userId: string,
  onEvent: (event: OvertimeRequestChangeEvent) => void
): () => void {
  const channel = supabase
    .channel(`overtime_requests:user:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'overtime_requests',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onEvent({ eventType: 'INSERT', new: payload.new as OvertimeRequest, old: {} })
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'overtime_requests',
        filter: `user_id=eq.${userId}`,
      },
      (payload) =>
        onEvent({
          eventType: 'UPDATE',
          new: payload.new as OvertimeRequest,
          old: payload.old as Partial<OvertimeRequest>,
        })
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToAllOvertimeRequests(
  onEvent: (event: OvertimeRequestChangeEvent) => void
): () => void {
  const channel = supabase
    .channel('overtime_requests:all')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'overtime_requests' },
      (payload) => onEvent({ eventType: 'INSERT', new: payload.new as OvertimeRequest, old: {} })
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'overtime_requests' },
      (payload) =>
        onEvent({
          eventType: 'UPDATE',
          new: payload.new as OvertimeRequest,
          old: payload.old as Partial<OvertimeRequest>,
        })
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
