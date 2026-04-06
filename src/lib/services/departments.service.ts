import { supabase } from '../supabase';
import * as profilesService from './profiles.service';
import type { Tables, InsertTables, UpdateTables } from '../database.types';
import type { Profile } from './profiles.service';

export type Department = Tables<'departments'>;
export type DepartmentInsert = InsertTables<'departments'>;
export type DepartmentUpdate = UpdateTables<'departments'>;

export async function listDepartments(): Promise<Department[]> {
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .order('name_ar');

  if (error) throw error;
  return data ?? [];
}

export interface ListDepartmentsPaginatedResult {
  data: Department[];
  total: number;
}

/** List departments with limit/offset for pagination. Use when list is large. */
export async function listDepartmentsPaginated(
  limit: number,
  offset: number
): Promise<ListDepartmentsPaginatedResult> {
  const { data: page, error, count } = await supabase
    .from('departments')
    .select('*', { count: 'exact' })
    .order('name_ar')
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return { data: page ?? [], total: count ?? 0 };
}

export async function getDepartmentById(id: string): Promise<Department | null> {
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getDepartmentByManagerUid(managerUid: string): Promise<Department | null> {
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .eq('manager_uid', managerUid)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function setDepartmentManager(
  departmentId: string,
  managerId: string | null
): Promise<Department> {
  return updateDepartment(departmentId, { manager_uid: managerId });
}

export async function listAttachableDepartmentEmployees(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select(profilesService.PROFILE_SELECT_COLUMNS)
    .eq('role', 'employee')
    .is('department_id', null)
    .order('name_ar');

  if (error) throw error;
  return data ?? [];
}

export async function attachDepartmentMember(
  departmentId: string,
  userId: string
): Promise<Profile> {
  return profilesService.updateUser(userId, { department_id: departmentId });
}

export async function detachDepartmentMember(
  departmentId: string,
  userId: string
): Promise<Profile> {
  const department = await getDepartmentById(departmentId);

  if (department?.manager_uid === userId) {
    await setDepartmentManager(departmentId, null);
  }

  return profilesService.updateUser(userId, { department_id: null });
}

export async function createDepartment(dept: DepartmentInsert): Promise<Department> {
  const { data, error } = await supabase
    .from('departments')
    .insert(dept)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateDepartment(
  id: string,
  updates: DepartmentUpdate
): Promise<Department> {
  const { data, error } = await supabase
    .from('departments')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteDepartment(id: string): Promise<void> {
  const { error } = await supabase.from('departments').delete().eq('id', id);

  if (error) throw error;
}

export async function getDepartmentWithEmployeeCount(): Promise<
  (Department & { employee_count: number })[]
> {
  const departments = await listDepartments();
  if (departments.length === 0) return [];

  const ids = departments.map((d) => d.id);
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('department_id')
    .in('department_id', ids);

  if (error) throw error;

  const countByDept = (profiles ?? []).reduce<Record<string, number>>((acc, p) => {
    if (p.department_id) {
      acc[p.department_id] = (acc[p.department_id] ?? 0) + 1;
    }
    return acc;
  }, {});

  return departments.map((dept) => ({
    ...dept,
    employee_count: countByDept[dept.id] ?? 0,
  }));
}
