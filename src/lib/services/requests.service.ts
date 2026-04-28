import { supabase } from '../supabase';
import type { Tables, InsertTables } from '../database.types';
import {
  emitLeaveRequestDecided,
  emitLeaveRequestSubmitted,
} from '@/lib/notifications/emit';

export type LeaveRequest = Tables<'leave_requests'>;
export type LeaveRequestInsert = InsertTables<'leave_requests'>;
export type RequestStatus = LeaveRequest['status'];
export type RequestType = LeaveRequest['type'];
export type ApproverProfileSummary = Pick<Tables<'profiles'>, 'id' | 'name_ar' | 'employee_id'>;
export type LeaveRequestWithApprover = LeaveRequest & {
  approver_profile?: ApproverProfileSummary | null;
};

async function attachApproverProfiles(
  requests: LeaveRequest[]
): Promise<LeaveRequestWithApprover[]> {
  const approverIds = Array.from(
    new Set(
      requests
        .map((request) => request.approver_id)
        .filter((approverId): approverId is string => Boolean(approverId))
    )
  );

  if (!approverIds.length) {
    return requests.map((request) => ({ ...request, approver_profile: null }));
  }

  const { data: approvers, error } = await supabase
    .from('profiles')
    .select('id, name_ar, employee_id')
    .in('id', approverIds);

  if (error) throw error;

  const approverMap = new Map((approvers ?? []).map((approver) => [approver.id, approver]));

  return requests.map((request) => ({
    ...request,
    approver_profile: request.approver_id ? approverMap.get(request.approver_id) ?? null : null,
  }));
}

export async function submitRequest(
  request: Omit<LeaveRequestInsert, 'id' | 'status' | 'created_at'>
): Promise<LeaveRequest> {
  const { data, error } = await supabase
    .from('leave_requests')
    .insert(request)
    .select()
    .single();

  if (error) throw error;
  void emitLeaveRequestSubmitted({
    request_id: data.id,
    requester_id: data.user_id,
    org_id: data.org_id,
  });
  return data;
}

export async function getUserRequests(userId: string): Promise<LeaveRequest[]> {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return attachApproverProfiles(data ?? []);
}

export async function getUserRequestsByStatus(
  userId: string,
  status: RequestStatus
): Promise<LeaveRequest[]> {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('user_id', userId)
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return attachApproverProfiles(data ?? []);
}

export async function getDepartmentRequests(
  departmentId: string
): Promise<LeaveRequest[]> {
  const { data: employees, error: empErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('department_id', departmentId);

  if (empErr) throw empErr;
  if (!employees?.length) return [];

  const userIds = employees.map((e) => e.id);

  const { data, error } = await supabase
    .from('leave_requests')
    .select('*')
    .in('user_id', userIds)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return attachApproverProfiles(data ?? []);
}

export async function getPendingDepartmentRequests(
  departmentId: string
): Promise<LeaveRequest[]> {
  const { data: employees, error: empErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('department_id', departmentId);

  if (empErr) throw empErr;
  if (!employees?.length) return [];

  const userIds = employees.map((e) => e.id);

  const { data, error } = await supabase
    .from('leave_requests')
    .select('*')
    .in('user_id', userIds)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return attachApproverProfiles(data ?? []);
}

export async function updateRequestStatus(
  requestId: string,
  status: RequestStatus,
  approverId: string,
  decisionNote: string
): Promise<LeaveRequest> {
  const decidedAt = new Date().toISOString();

  const { data: updatedRows, error } = await supabase
    .from('leave_requests')
    .update({
      status,
      approver_id: approverId,
      decision_note: decisionNote,
      decided_at: decidedAt,
    })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select();

  if (error) throw error;
  const data = updatedRows?.[0];
  if (!data) {
    throw new Error('لا يمكن تحديث الطلب لأنه لم يعد قيد الانتظار.');
  }

  const { error: approvalLogError } = await supabase.from('approval_logs').insert({
    org_id: data.org_id,
    request_id: data.id,
    actor_id: approverId,
    action: status,
    comment: decisionNote || null,
  });

  if (approvalLogError) throw approvalLogError;

  if (status === 'approved' && data.type === 'time_adjustment') {
    const { error: correctionError } = await supabase.rpc(
      'approve_attendance_correction_from_leave_request',
      {
        p_leave_request_id: data.id,
        p_approver_id: approverId,
      }
    );
    if (correctionError) throw correctionError;
  }

  if (status === 'approved' || status === 'rejected') {
    void emitLeaveRequestDecided({
      request_id: data.id,
      requester_id: data.user_id,
      status,
      decision_note: data.decision_note,
      actor_id: approverId,
    });
  }

  const enriched = await attachApproverProfiles([data]);
  return enriched[0];
}

export async function getRequestById(requestId: string): Promise<LeaveRequest | null> {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const enriched = await attachApproverProfiles([data]);
  return enriched[0];
}

export async function getAllPendingRequests(): Promise<LeaveRequest[]> {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return attachApproverProfiles(data ?? []);
}

export async function getAllRequests(): Promise<LeaveRequest[]> {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return attachApproverProfiles(data ?? []);
}

export type RequestChangeEvent = {
  eventType: 'INSERT' | 'UPDATE';
  new: LeaveRequest;
  old: Partial<LeaveRequest>;
};

export function subscribeToUserRequests(
  userId: string,
  onEvent: (event: RequestChangeEvent) => void
): () => void {
  const channel = supabase
    .channel(`leave_requests:user:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'leave_requests',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onEvent({ eventType: 'INSERT', new: payload.new as LeaveRequest, old: {} })
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'leave_requests',
        filter: `user_id=eq.${userId}`,
      },
      (payload) =>
        onEvent({
          eventType: 'UPDATE',
          new: payload.new as LeaveRequest,
          old: payload.old as Partial<LeaveRequest>,
        })
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToAllRequests(
  onEvent: (event: RequestChangeEvent) => void
): () => void {
  const channel = supabase
    .channel('leave_requests:all')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'leave_requests' },
      (payload) => onEvent({ eventType: 'INSERT', new: payload.new as LeaveRequest, old: {} })
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'leave_requests' },
      (payload) =>
        onEvent({
          eventType: 'UPDATE',
          new: payload.new as LeaveRequest,
          old: payload.old as Partial<LeaveRequest>,
        })
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function countPendingRequests(departmentId?: string): Promise<number> {
  if (departmentId) {
    const { data: employees, error: empErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('department_id', departmentId);

    if (empErr) throw empErr;
    if (!employees?.length) return 0;

    const userIds = employees.map((e) => e.id);

    const { count, error } = await supabase
      .from('leave_requests')
      .select('*', { count: 'exact', head: true })
      .in('user_id', userIds)
      .eq('status', 'pending');

    if (error) throw error;
    return count ?? 0;
  }

  const { count, error } = await supabase
    .from('leave_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  if (error) throw error;
  return count ?? 0;
}
