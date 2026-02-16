import { supabase } from '../supabase';
import type { Tables, InsertTables } from '../database.types';

export type LeaveRequest = Tables<'leave_requests'>;
export type LeaveRequestInsert = InsertTables<'leave_requests'>;
export type RequestStatus = LeaveRequest['status'];
export type RequestType = LeaveRequest['type'];

export async function submitRequest(
  request: Omit<LeaveRequestInsert, 'id' | 'status' | 'created_at'>
): Promise<LeaveRequest> {
  const { data, error } = await supabase
    .from('leave_requests')
    .insert(request)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getUserRequests(userId: string): Promise<LeaveRequest[]> {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
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
  return data ?? [];
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
  return data ?? [];
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
  return data ?? [];
}

export async function updateRequestStatus(
  requestId: string,
  status: RequestStatus,
  approverId: string,
  decisionNote: string
): Promise<LeaveRequest> {
  const { data, error } = await supabase
    .from('leave_requests')
    .update({
      status,
      approver_id: approverId,
      decision_note: decisionNote,
    })
    .eq('id', requestId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getRequestById(requestId: string): Promise<LeaveRequest | null> {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getAllPendingRequests(): Promise<LeaveRequest[]> {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
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
