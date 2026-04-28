import { parseBearerToken } from '../_shared/bearer.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { sendWebPushToUser } from '../_shared/web-push.ts';

// deno-lint-ignore no-explicit-any
type ServiceClient = any;

type SubmittedEvent =
  | { event: 'leave_request_submitted'; request_id: string; requester_id: string; org_id: string }
  | { event: 'overtime_request_submitted'; request_id: string; requester_id: string; org_id: string };

type DecidedEvent =
  | {
      event: 'leave_request_decided';
      request_id: string;
      requester_id: string;
      status: 'approved' | 'rejected';
      decision_note: string | null;
      actor_id: string;
    }
  | {
      event: 'overtime_request_decided';
      request_id: string;
      requester_id: string;
      status: 'approved' | 'rejected';
      decision_note: string | null;
      actor_id: string;
    };

type ScheduleEvent = {
  event: 'schedule_changed';
  employee_id: string;
  actor_id: string;
};

type NotifyEvent = SubmittedEvent | DecidedEvent | ScheduleEvent;

type NotifyDeps = {
  createServiceClient: () => ServiceClient;
};

type ProfileRow = {
  id: string;
  org_id: string;
  role: 'admin' | 'manager' | 'employee';
  department_id: string | null;
  name: string;
  name_ar: string;
};

type NotificationTemplate = {
  title: string;
  title_ar: string;
  message: string;
  message_ar: string;
  type: 'approval' | 'request_update';
  linkUrl: string;
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function asSafeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isValidEvent(payload: unknown): payload is NotifyEvent {
  if (!payload || typeof payload !== 'object') return false;
  const event = asSafeString((payload as { event?: unknown }).event);
  if (!event) return false;

  if (event === 'schedule_changed') {
    return (
      asSafeString((payload as { employee_id?: unknown }).employee_id).length > 0 &&
      asSafeString((payload as { actor_id?: unknown }).actor_id).length > 0
    );
  }

  if (event === 'leave_request_submitted' || event === 'overtime_request_submitted') {
    return (
      asSafeString((payload as { request_id?: unknown }).request_id).length > 0 &&
      asSafeString((payload as { requester_id?: unknown }).requester_id).length > 0 &&
      asSafeString((payload as { org_id?: unknown }).org_id).length > 0
    );
  }

  if (event === 'leave_request_decided' || event === 'overtime_request_decided') {
    const status = asSafeString((payload as { status?: unknown }).status);
    return (
      asSafeString((payload as { request_id?: unknown }).request_id).length > 0 &&
      asSafeString((payload as { requester_id?: unknown }).requester_id).length > 0 &&
      asSafeString((payload as { actor_id?: unknown }).actor_id).length > 0 &&
      (status === 'approved' || status === 'rejected')
    );
  }

  return false;
}

function appendDecisionNote(base: string, note: string | null | undefined): string {
  const safe = asSafeString(note);
  return safe ? `${base}. ${safe}` : base;
}

function leaveTypeLabel(type: string): { en: string; ar: string } {
  if (type === 'sick') return { en: 'sick leave', ar: 'إجازة مرضية' };
  if (type === 'annual') return { en: 'annual leave', ar: 'إجازة سنوية' };
  if (type === 'time_adjustment') return { en: 'time adjustment', ar: 'تصحيح دوام' };
  return { en: type || 'leave', ar: type || 'إجازة' };
}

async function getCaller(admin: ServiceClient, req: Request): Promise<{ id: string } | null> {
  const token = parseBearerToken(req);
  if (!token) return null;

  const userResult = await admin.auth.getUser(token);
  const user = (userResult as { data?: { user?: { id: string } | null } })?.data?.user ?? null;
  const userError = (userResult as { error?: unknown })?.error ?? null;
  if (userError || !user) return null;
  return { id: user.id };
}

async function getProfile(admin: ServiceClient, userId: string): Promise<ProfileRow | null> {
  const { data } = await admin
    .from('profiles')
    .select('id, org_id, role, department_id, name, name_ar')
    .eq('id', userId)
    .maybeSingle();
  return (data as ProfileRow | null) ?? null;
}

async function getAdminIds(admin: ServiceClient, orgId: string): Promise<string[]> {
  const { data } = await admin
    .from('profiles')
    .select('id')
    .eq('org_id', orgId)
    .eq('role', 'admin');
  return ((data ?? []) as Array<{ id: string }>).map((row) => row.id);
}

async function getDepartmentManagerId(admin: ServiceClient, departmentId: string | null): Promise<string | null> {
  if (!departmentId) return null;
  const { data } = await admin
    .from('departments')
    .select('manager_uid')
    .eq('id', departmentId)
    .maybeSingle();
  const managerId = (data as { manager_uid?: string | null } | null)?.manager_uid ?? null;
  return managerId;
}

function uniqueUserIds(ids: Array<string | null | undefined>): string[] {
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
}

async function applyTeamPreferenceFilter(
  admin: ServiceClient,
  recipients: string[],
  key: 'leave_requests_team' | 'overtime_requests_team'
): Promise<string[]> {
  if (recipients.length === 0) return [];

  const { data } = await admin
    .from('notification_preferences')
    .select(`user_id, ${key}`)
    .in('user_id', recipients);

  const prefRows = (data ?? []) as Array<{ user_id: string } & Record<string, boolean>>;
  const prefMap = new Map(prefRows.map((row) => [row.user_id, row[key]]));
  return recipients.filter((userId) => prefMap.get(userId) ?? true);
}

async function resolveSubmittedRecipients(
  admin: ServiceClient,
  requester: ProfileRow,
  event: SubmittedEvent
): Promise<string[]> {
  const admins = await getAdminIds(admin, requester.org_id);
  const deptManagerId = requester.role === 'employee'
    ? await getDepartmentManagerId(admin, requester.department_id)
    : null;

  const baseRecipients = requester.role === 'employee'
    ? uniqueUserIds([deptManagerId, ...admins])
    : uniqueUserIds(admins);

  const withoutRequester = baseRecipients.filter((id) => id !== requester.id);
  const prefKey = event.event === 'leave_request_submitted' ? 'leave_requests_team' : 'overtime_requests_team';
  return applyTeamPreferenceFilter(admin, withoutRequester, prefKey);
}

async function buildSubmittedNotification(
  admin: ServiceClient,
  callerId: string,
  event: SubmittedEvent
): Promise<{ orgId: string; recipients: string[]; template: NotificationTemplate } | null> {
  if (event.event === 'leave_request_submitted') {
    const { data } = await admin
      .from('leave_requests')
      .select('id, user_id, org_id, type')
      .eq('id', event.request_id)
      .maybeSingle();

    const leaveRequest = data as
      | { id: string; user_id: string; org_id: string; type: string }
      | null;

    if (!leaveRequest) return null;
    if (leaveRequest.user_id !== callerId || leaveRequest.user_id !== event.requester_id) return null;
    if (leaveRequest.org_id !== event.org_id) return null;

    const requester = await getProfile(admin, leaveRequest.user_id);
    if (!requester || requester.org_id !== leaveRequest.org_id) return null;

    const recipients = await resolveSubmittedRecipients(admin, requester, event);
    const leaveType = leaveTypeLabel(leaveRequest.type);

    return {
      orgId: leaveRequest.org_id,
      recipients,
      template: {
        title: 'New leave request',
        title_ar: 'طلب إجازة جديد',
        message: `${requester.name} submitted a ${leaveType.en} request`,
        message_ar: `قدّم ${requester.name_ar} طلب ${leaveType.ar}`,
        type: 'approval',
        linkUrl: `/approvals?highlight=${leaveRequest.id}`,
      },
    };
  }

  const { data } = await admin
    .from('overtime_requests')
    .select('id, user_id, org_id')
    .eq('id', event.request_id)
    .maybeSingle();

  const overtimeRequest = data as
    | { id: string; user_id: string; org_id: string }
    | null;
  if (!overtimeRequest) return null;
  if (overtimeRequest.user_id !== callerId || overtimeRequest.user_id !== event.requester_id) return null;
  if (overtimeRequest.org_id !== event.org_id) return null;

  const requester = await getProfile(admin, overtimeRequest.user_id);
  if (!requester || requester.org_id !== overtimeRequest.org_id) return null;

  const recipients = await resolveSubmittedRecipients(admin, requester, event);
  return {
    orgId: overtimeRequest.org_id,
    recipients,
    template: {
      title: 'New overtime request',
      title_ar: 'طلب عمل إضافي جديد',
      message: `${requester.name} submitted an overtime request`,
      message_ar: `قدّم ${requester.name_ar} طلب عمل إضافي`,
      type: 'approval',
      linkUrl: `/approvals?highlight=${overtimeRequest.id}`,
    },
  };
}

async function buildDecidedNotification(
  admin: ServiceClient,
  callerId: string,
  event: DecidedEvent
): Promise<{ orgId: string; recipients: string[]; template: NotificationTemplate } | null> {
  if (event.event === 'leave_request_decided') {
    const { data } = await admin
      .from('leave_requests')
      .select('id, user_id, org_id, approver_id, status, decision_note, type')
      .eq('id', event.request_id)
      .maybeSingle();

    const row = data as
      | {
          id: string;
          user_id: string;
          org_id: string;
          approver_id: string | null;
          status: 'approved' | 'rejected' | 'pending';
          decision_note: string | null;
          type: string;
        }
      | null;
    if (!row) return null;
    if (row.approver_id !== callerId || event.actor_id !== callerId) return null;
    if (row.user_id !== event.requester_id || row.status !== event.status) return null;
    if (row.user_id === callerId) return { orgId: row.org_id, recipients: [], template: {
      title: '',
      title_ar: '',
      message: '',
      message_ar: '',
      type: 'request_update',
      linkUrl: '',
    } };

    const leaveType = leaveTypeLabel(row.type);
    const approved = row.status === 'approved';
    const enBase = approved
      ? `Your ${leaveType.en} request was approved`
      : `Your ${leaveType.en} request was rejected`;
    const arBase = approved
      ? `تمت الموافقة على طلب ${leaveType.ar} الخاص بك`
      : `تم رفض طلب ${leaveType.ar} الخاص بك`;

    return {
      orgId: row.org_id,
      recipients: [row.user_id],
      template: {
        title: approved ? 'Leave request approved' : 'Leave request rejected',
        title_ar: approved ? 'تمت الموافقة على طلب الإجازة' : 'تم رفض طلب الإجازة',
        message: appendDecisionNote(enBase, approved ? null : row.decision_note),
        message_ar: appendDecisionNote(arBase, approved ? null : row.decision_note),
        type: 'request_update',
        linkUrl: `/requests?highlight=${row.id}`,
      },
    };
  }

  const { data } = await admin
    .from('overtime_requests')
    .select('id, user_id, org_id, reviewed_by, status, note')
    .eq('id', event.request_id)
    .maybeSingle();

  const row = data as
    | {
        id: string;
        user_id: string;
        org_id: string;
        reviewed_by: string | null;
        status: 'approved' | 'rejected' | 'pending';
        note: string | null;
      }
    | null;
  if (!row) return null;
  if (row.reviewed_by !== callerId || event.actor_id !== callerId) return null;
  if (row.user_id !== event.requester_id || row.status !== event.status) return null;
  if (row.user_id === callerId) return { orgId: row.org_id, recipients: [], template: {
    title: '',
    title_ar: '',
    message: '',
    message_ar: '',
    type: 'request_update',
    linkUrl: '',
  } };

  const approved = row.status === 'approved';
  const enBase = approved
    ? 'Your overtime request was approved'
    : 'Your overtime request was rejected';
  const arBase = approved
    ? 'تمت الموافقة على طلب العمل الإضافي الخاص بك'
    : 'تم رفض طلب العمل الإضافي الخاص بك';

  return {
    orgId: row.org_id,
    recipients: [row.user_id],
    template: {
      title: approved ? 'Overtime request approved' : 'Overtime request rejected',
      title_ar: approved ? 'تمت الموافقة على طلب العمل الإضافي' : 'تم رفض طلب العمل الإضافي',
      message: appendDecisionNote(enBase, approved ? null : row.note),
      message_ar: appendDecisionNote(arBase, approved ? null : row.note),
      type: 'request_update',
      linkUrl: `/requests?highlight=${row.id}`,
    },
  };
}

async function buildScheduleNotification(
  admin: ServiceClient,
  callerId: string,
  event: ScheduleEvent
): Promise<{ orgId: string; recipients: string[]; template: NotificationTemplate } | null> {
  if (event.actor_id !== callerId) return null;
  if (event.actor_id === event.employee_id) {
    const actor = await getProfile(admin, callerId);
    return actor ? { orgId: actor.org_id, recipients: [], template: {
      title: '',
      title_ar: '',
      message: '',
      message_ar: '',
      type: 'request_update',
      linkUrl: '',
    } } : null;
  }

  const [actor, employee] = await Promise.all([
    getProfile(admin, event.actor_id),
    getProfile(admin, event.employee_id),
  ]);
  if (!actor || !employee) return null;
  if (actor.org_id !== employee.org_id) return null;
  if (actor.role !== 'admin' && actor.role !== 'manager') return null;

  return {
    orgId: employee.org_id,
    recipients: [employee.id],
    template: {
      title: 'Schedule updated',
      title_ar: 'تم تحديث الجدول',
      message: 'Your work schedule was updated',
      message_ar: 'تم تحديث جدول عملك',
      type: 'request_update',
      linkUrl: `/user-details/${employee.id}`,
    },
  };
}

export async function handleNotify(req: Request, deps: NotifyDeps): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
  }

  const admin = deps.createServiceClient();
  const caller = await getCaller(admin, req);
  if (!caller) {
    return jsonResponse({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  let payload: unknown = null;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload', code: 'INVALID_PAYLOAD' }, 400);
  }
  if (!isValidEvent(payload)) {
    return jsonResponse({ error: 'Invalid event payload', code: 'INVALID_PAYLOAD' }, 400);
  }

  try {
    let resolved:
      | { orgId: string; recipients: string[]; template: NotificationTemplate }
      | null = null;

    if (payload.event === 'leave_request_submitted' || payload.event === 'overtime_request_submitted') {
      resolved = await buildSubmittedNotification(admin, caller.id, payload);
    } else if (payload.event === 'leave_request_decided' || payload.event === 'overtime_request_decided') {
      resolved = await buildDecidedNotification(admin, caller.id, payload);
    } else {
      resolved = await buildScheduleNotification(admin, caller.id, payload);
    }

    if (!resolved) {
      return jsonResponse({ error: 'Forbidden', code: 'FORBIDDEN' }, 403);
    }

    if (resolved.recipients.length === 0) {
      return jsonResponse({ ok: true, sent: 0, errors: [] }, 200);
    }

    const errors: string[] = [];
    let sent = 0;

    for (const recipientId of resolved.recipients) {
      const { data: inserted, error: insertError } = await admin
        .from('notifications')
        .insert({
          org_id: resolved.orgId,
          user_id: recipientId,
          title: resolved.template.title,
          title_ar: resolved.template.title_ar,
          message: resolved.template.message,
          message_ar: resolved.template.message_ar,
          type: resolved.template.type,
          link_url: resolved.template.linkUrl,
        })
        .select('id')
        .maybeSingle();

      if (insertError) {
        errors.push(`insert_failed:${recipientId}`);
        continue;
      }

      try {
        const notificationId = (inserted as { id?: string } | null)?.id;
        await sendWebPushToUser(admin, recipientId, {
          title: resolved.template.title_ar,
          body: resolved.template.message_ar,
          url: resolved.template.linkUrl,
          notificationId,
        });
      } catch {
        errors.push(`push_failed:${recipientId}`);
      }

      sent += 1;
    }

    return jsonResponse({ ok: errors.length === 0, sent, errors }, 200);
  } catch (error) {
    console.error('[notify] unexpected error', error);
    return jsonResponse({
      ok: false,
      sent: 0,
      errors: [error instanceof Error ? error.message : 'INTERNAL'],
    }, 200);
  }
}
