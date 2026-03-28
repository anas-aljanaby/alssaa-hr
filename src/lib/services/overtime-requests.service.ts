import { supabase } from '../supabase';
import type { Tables } from '../database.types';

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

export async function getDepartmentOvertimeRequests(departmentId: string): Promise<OvertimeRequestWithSessionAndReviewer[]> {
  const { data: employees, error: empErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('department_id', departmentId);
  if (empErr) throw empErr;
  if (!employees?.length) return [];
  const userIds = employees.map((e) => e.id);
  const { data, error } = await supabase
    .from('overtime_requests')
    .select(overtimeSelectWithSession)
    .in('user_id', userIds)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as OvertimeRequestWithSession[];
  return attachReviewerProfiles(rows);
}

export async function getAllOvertimeRequests(): Promise<OvertimeRequestWithSessionAndReviewer[]> {
  const { data, error } = await supabase
    .from('overtime_requests')
    .select(overtimeSelectWithSession)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as OvertimeRequestWithSession[];
  return attachReviewerProfiles(rows);
}

export async function updateOvertimeRequestStatus(
  requestId: string,
  status: OvertimeRequestStatus,
  reviewerId: string,
  decisionNote: string
): Promise<OvertimeRequest> {
  const { data, error } = await supabase
    .from('overtime_requests')
    .update({
      status,
      reviewed_by: reviewerId,
      note: decisionNote || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function countPendingOvertimeRequests(departmentId?: string): Promise<number> {
  if (departmentId) {
    const { data: employees, error: empErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('department_id', departmentId);
    if (empErr) throw empErr;
    if (!employees?.length) return 0;
    const userIds = employees.map((e) => e.id);
    const { count, error } = await supabase
      .from('overtime_requests')
      .select('*', { count: 'exact', head: true })
      .in('user_id', userIds)
      .eq('status', 'pending');
    if (error) throw error;
    return count ?? 0;
  }
  const { count, error } = await supabase
    .from('overtime_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error) throw error;
  return count ?? 0;
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
