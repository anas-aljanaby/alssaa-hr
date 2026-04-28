/**
 * FIFO PostgREST mock for Deno tests: each awaited chain consumes one queued { data, error }.
 */

export type QResult = { data: unknown; error: unknown | null };
export type QCall = {
  table?: string;
  rpc?: string;
  op: string;
  payload?: unknown;
  filters: Array<{ method: string; args: unknown[] }>;
};

export function createQueuedFromClient(queue: QResult[], calls?: QCall[]) {
  const dq = (): QResult => queue.shift() ?? { data: null, error: null };
  function mkBuilder(table: string): PromiseLike<QResult> & Record<string, (...args: unknown[]) => unknown> {
    const b = {} as Record<string, unknown>;
    const call: QCall = { table, op: 'select', filters: [] };
    const chain = (method: string, args: unknown[]) => {
      if (method === 'insert' || method === 'update' || method === 'upsert') {
        call.op = method;
        call.payload = args[0];
      } else if (method === 'delete') {
        call.op = method;
      }
      call.filters.push({ method, args });
      return b;
    };
    const names = [
      'select',
      'insert',
      'update',
      'upsert',
      'delete',
      'eq',
      'not',
      'neq',
      'in',
      'gte',
      'lte',
      'order',
      'limit',
      'range',
      'maybeSingle',
      'single',
      'is',
    ];
    for (const n of names) {
      b[n] = (...args: unknown[]) => chain(n, args);
    }
    b.then = (onF: (v: QResult) => unknown, onR?: (e: unknown) => unknown) =>
      Promise.resolve(dq()).then((result) => {
        calls?.push(call);
        return onF(result);
      }, onR);
    return b as PromiseLike<QResult> & Record<string, (...args: unknown[]) => unknown>;
  }
  return {
    from: (table: string) => mkBuilder(table),
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      const result = dq();
      calls?.push({ rpc: fn, op: 'rpc', payload: args, filters: [] });
      return result;
    },
  };
}

export function json(res: Response): Promise<unknown> {
  return res.json();
}
