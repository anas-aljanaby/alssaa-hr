import { supabase } from '../supabase';

type EdgeInvokeResult = {
  data?: unknown;
  error?: { message?: string } | null;
};

type LeaveRequestSubmittedPayload = {
  request_id: string;
  requester_id: string;
  org_id: string;
};

type OvertimeRequestSubmittedPayload = {
  request_id: string;
  requester_id: string;
  org_id: string;
};

type LeaveRequestDecidedPayload = {
  request_id: string;
  requester_id: string;
  status: 'approved' | 'rejected';
  decision_note: string | null;
  actor_id: string;
};

type OvertimeRequestDecidedPayload = {
  request_id: string;
  requester_id: string;
  status: 'approved' | 'rejected';
  decision_note: string | null;
  actor_id: string;
};

type ScheduleChangedPayload = {
  employee_id: string;
  actor_id: string;
};

async function invokeNotify(eventBody: Record<string, unknown>): Promise<void> {
  const sessionResult = await supabase.auth.getSession();
  const session = sessionResult?.data?.session;
  const sessionError = sessionResult?.error;
  if (sessionError || !session?.access_token) return;

  const invoked = await supabase.functions.invoke('notify', {
    method: 'POST',
    body: eventBody,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  }) as EdgeInvokeResult;

  if (invoked.error) {
    throw new Error(invoked.error.message || 'notify invoke failed');
  }
}

async function fireAndForget(eventBody: Record<string, unknown>): Promise<void> {
  try {
    await invokeNotify(eventBody);
  } catch (error) {
    console.error('[notify] emit failed', error);
  }
}

export async function emitLeaveRequestSubmitted(payload: LeaveRequestSubmittedPayload): Promise<void> {
  await fireAndForget({ event: 'leave_request_submitted', ...payload });
}

export async function emitOvertimeRequestSubmitted(payload: OvertimeRequestSubmittedPayload): Promise<void> {
  await fireAndForget({ event: 'overtime_request_submitted', ...payload });
}

export async function emitLeaveRequestDecided(payload: LeaveRequestDecidedPayload): Promise<void> {
  await fireAndForget({ event: 'leave_request_decided', ...payload });
}

export async function emitOvertimeRequestDecided(payload: OvertimeRequestDecidedPayload): Promise<void> {
  await fireAndForget({ event: 'overtime_request_decided', ...payload });
}

export async function emitScheduleChanged(payload: ScheduleChangedPayload): Promise<void> {
  await fireAndForget({ event: 'schedule_changed', ...payload });
}
