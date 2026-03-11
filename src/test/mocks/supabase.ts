/**
 * Test-only Supabase client mock: chainable PostgREST builders share a FIFO result queue.
 * Each awaited query (thenable builder) consumes one queued { data, error, count }.
 * Configure auth, functions.invoke, rpc, and storage via the returned vi.fn() handles.
 */

import { vi } from 'vitest';

export type MockQueryResult = {
  data: unknown;
  error: unknown;
  count?: number | null;
};

function createQueryBuilder(dequeue: () => MockQueryResult) {
  const builder: Record<string, unknown> = {};

  const chain = () => builder;

  const methods = [
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'neq',
    'in',
    'gte',
    'lte',
    'order',
    'limit',
    'range',
    'maybeSingle',
    'single',
  ] as const;

  for (const m of methods) {
    builder[m] = vi.fn(chain);
  }

  builder.then = (onFulfilled: (v: MockQueryResult) => unknown, onRejected?: (e: unknown) => unknown) => {
    const r = dequeue();
    return Promise.resolve(r).then(onFulfilled, onRejected);
  };

  return builder as PromiseLike<MockQueryResult> & Record<string, ReturnType<typeof vi.fn>>;
}

export type MockQueryBuilder = ReturnType<typeof createQueryBuilder>;

export function createMockSupabaseClient() {
  const queue: MockQueryResult[] = [];

  const dequeue = (): MockQueryResult => {
    const next = queue.shift();
    if (next) return next;
    return { data: null, error: null };
  };

  const from = vi.fn((_table: string) => createQueryBuilder(dequeue));

  const auth = {
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    getUser: vi.fn(),
    getSession: vi.fn(),
    refreshSession: vi.fn(),
    updateUser: vi.fn(),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
  };

  const functions = {
    invoke: vi.fn(),
  };

  const rpc = vi.fn();

  const storageBucket = {
    upload: vi.fn(),
    createSignedUrl: vi.fn(),
    remove: vi.fn(),
  };

  const storage = {
    from: vi.fn(() => storageBucket),
  };

  const channelInstances: Array<{
    name: string;
    on: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
  }> = [];

  const channel = vi.fn((name: string) => {
    const ch = {
      name,
      on: vi.fn(() => ch),
      subscribe: vi.fn(() => 'SUBSCRIBED' as const),
    };
    channelInstances.push(ch);
    return ch;
  });

  const removeChannel = vi.fn();

  const supabase = {
    from,
    auth,
    functions,
    rpc,
    storage,
    channel,
    removeChannel,
  };

  return {
    supabase,
    /** Enqueue the next PostgREST await result (FIFO). */
    queueResult: (r: MockQueryResult) => {
      queue.push(r);
    },
    /** Clear queued query results (not vi.fn call history). */
    clearQueue: () => {
      queue.length = 0;
    },
    clearChannelInstances: () => {
      channelInstances.length = 0;
    },
    from,
    auth,
    functions,
    rpc,
    storage,
    storageBucket,
    channel,
    removeChannel,
    channelInstances,
  };
}

export type MockSupabasePack = ReturnType<typeof createMockSupabaseClient>;
