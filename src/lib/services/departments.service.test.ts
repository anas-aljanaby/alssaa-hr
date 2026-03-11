import { describe, it, expect, beforeEach } from 'vitest';
import { activeMockSupabase as sb } from '@/test/mocks/active-supabase-mock';

vi.mock('../supabase');

const dept = {
  id: 'd1',
  org_id: 'o1',
  name: 'Tech',
  name_ar: 'تقنية',
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
});
