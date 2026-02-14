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

  const enriched = await Promise.all(
    departments.map(async (dept) => {
      const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('department_id', dept.id);

      if (error) throw error;
      return { ...dept, employee_count: count ?? 0 };
    })
  );

  return enriched;
}
