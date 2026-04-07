import { describe, it, expect, beforeEach } from 'vitest';
import { activeMockSupabase as sb } from '@/test/mocks/active-supabase-mock';

vi.mock('../supabase');

const dept = {
  id: 'd1',
  org_id: 'o1',
  name: 'Tech',
  name_ar: 'تقنية',
  color: '#2563EB',
  manager_uid: null as string | null,
  created_at: '2025-01-01T00:00:00Z',
};

describe('departments.service', () => {
  beforeEach(() => {
    sb.clearQueue();
  });

  it('listDepartments returns rows', async () => {
    sb.queueResult({ data: [dept], error: null });
    const { listDepartments } = await import('./departments.service');
    const list = await listDepartments();
    expect(list).toHaveLength(1);
  });

  it('listDepartmentsPaginated returns data and total', async () => {
    sb.queueResult({ data: [dept], error: null, count: 5 });
    const { listDepartmentsPaginated } = await import('./departments.service');
    const r = await listDepartmentsPaginated(10, 0);
    expect(r.data).toHaveLength(1);
    expect(r.total).toBe(5);
  });

  it('getDepartmentById returns row', async () => {
    sb.queueResult({ data: dept, error: null });
    const { getDepartmentById } = await import('./departments.service');
    expect(await getDepartmentById('d1')).toEqual(dept);
  });

  it('createDepartment inserts', async () => {
    sb.queueResult({ data: [dept], error: null });
    sb.queueResult({ data: dept, error: null });
    const { createDepartment } = await import('./departments.service');
    const row = await createDepartment({
      org_id: 'o1',
      name: 'Tech',
      name_ar: 'تقنية',
    });
    expect(row.id).toBe('d1');
  });

  it('updateDepartment updates', async () => {
    sb.queueResult({ data: { ...dept, name_ar: 'جديد' }, error: null });
    const { updateDepartment } = await import('./departments.service');
    const row = await updateDepartment('d1', { name_ar: 'جديد' });
    expect(row.name_ar).toBe('جديد');
  });

  it('deleteDepartment completes', async () => {
    sb.queueResult({ data: null, error: null });
    const { deleteDepartment } = await import('./departments.service');
    await expect(deleteDepartment('d1')).resolves.toBeUndefined();
  });

  it('getDepartmentWithEmployeeCount merges counts', async () => {
    sb.queueResult({ data: [dept], error: null });
    sb.queueResult({
      data: [{ department_id: 'd1' }, { department_id: 'd1' }],
      error: null,
    });
    const { getDepartmentWithEmployeeCount } = await import('./departments.service');
    const rows = await getDepartmentWithEmployeeCount();
    expect(rows[0].employee_count).toBe(2);
  });

  it('setDepartmentManager updates manager_uid', async () => {
    sb.queueResult({ data: { ...dept, manager_uid: 'u1' }, error: null });
    const { setDepartmentManager } = await import('./departments.service');
    const row = await setDepartmentManager('d1', 'u1');
    expect(row.manager_uid).toBe('u1');
  });

  it('listAttachableDepartmentEmployees returns unattached employees', async () => {
    sb.queueResult({
      data: [
        {
          id: 'u1',
          org_id: 'o1',
          employee_id: 'E1',
          name: 'N',
          name_ar: 'ن',
          email: 'n@example.com',
          role: 'employee',
          department_id: null,
          avatar_url: null,
          join_date: '2025-01-01',
          work_days: null,
          work_start_time: null,
          work_end_time: null,
        },
      ],
      error: null,
    });
    const { listAttachableDepartmentEmployees } = await import('./departments.service');
    const rows = await listAttachableDepartmentEmployees();
    expect(rows).toHaveLength(1);
    expect(sb.from).toHaveBeenCalledWith('profiles');
  });

  it('attachDepartmentMember updates the profile department', async () => {
    sb.queueResult({
      data: {
        id: 'u1',
        org_id: 'o1',
        employee_id: 'E1',
        name: 'N',
        name_ar: 'ن',
        email: 'n@example.com',
        phone: '',
        role: 'employee',
        department_id: 'd1',
        avatar_url: null,
        join_date: '2025-01-01',
        work_days: null,
        work_start_time: null,
        work_end_time: null,
      },
      error: null,
    });
    const { attachDepartmentMember } = await import('./departments.service');
    const row = await attachDepartmentMember('d1', 'u1');
    expect(row.department_id).toBe('d1');
  });

  it('detachDepartmentMember clears manager first when needed', async () => {
    sb.queueResult({ data: { ...dept, manager_uid: 'u1' }, error: null });
    sb.queueResult({ data: { ...dept, manager_uid: null }, error: null });
    sb.queueResult({
      data: {
        id: 'u1',
        org_id: 'o1',
        employee_id: 'E1',
        name: 'N',
        name_ar: 'ن',
        email: 'n@example.com',
        phone: '',
        role: 'employee',
        department_id: null,
        avatar_url: null,
        join_date: '2025-01-01',
        work_days: null,
        work_start_time: null,
        work_end_time: null,
      },
      error: null,
    });
    const { detachDepartmentMember } = await import('./departments.service');
    const row = await detachDepartmentMember('d1', 'u1');
    expect(row.department_id).toBeNull();
  });
});
