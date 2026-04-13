/**
 * FIFO PostgREST mock for Deno tests: each awaited chain consumes one queued { data, error }.
 */

export type QResult = { data: unknown; error: unknown | null };

export function createQueuedFromClient(queue: QResult[]) {
  const dq = (): QResult => queue.shift() ?? { data: null, error: null };
  function mkBuilder(): PromiseLike<QResult> & Record<string, () => unknown> {
    const b = {} as Record<string, unknown>;
    const chain = () => b;
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
      b[n] = chain;
    }
    b.then = (onF: (v: QResult) => unknown, onR?: (e: unknown) => unknown) =>
      Promise.resolve(dq()).then(onF, onR);
    return b as PromiseLike<QResult> & Record<string, () => unknown>;
  }
  return {
    from: (_table: string) => mkBuilder(),
    rpc: async (_fn: string, _args?: Record<string, unknown>) => dq(),
  };
}

export function json(res: Response): Promise<unknown> {
  return res.json();
}
