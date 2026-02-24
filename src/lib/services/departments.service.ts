import { supabase } from '../supabase';
import type { Tables, InsertTables, UpdateTables } from '../database.types';

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

export async function getDepartmentById(id: string): Promise<Department | null> {
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
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
