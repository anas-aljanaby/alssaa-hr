import { createMockSupabaseClient } from './supabase';

/** Singleton used by `src/lib/__mocks__/supabase.ts` and service tests. */
export const activeMockSupabase = createMockSupabaseClient();
