// Keeps two tabs (or two parts of one tab) from working on the same thing at once: the waiting
// changes live in the browser storage, which every tab of the app shares. The browser's Web Locks
// do this across tabs; without them (old browsers, tests) a lock inside the one tab has to do.

export interface Locker {
  /** Runs `work` once no one else holds the lock `name`; others wait their turn. */
  exclusive<T>(name: string, work: () => Promise<T>): Promise<T>;
  /** Like `exclusive`, but gives up at once (`undefined`) if someone holds the lock. */
  tryExclusive<T>(name: string, work: () => Promise<T>): Promise<T | undefined>;
}

/** Locks inside this tab only. */
export function memoryLocker(): Locker {
  const queues = new Map<string, Promise<unknown>>();
  const waiting = new Map<string, number>();

  const exclusive = async <T>(name: string, work: () => Promise<T>): Promise<T> => {
    waiting.set(name, (waiting.get(name) ?? 0) + 1);
    const previous = queues.get(name) ?? Promise.resolve();
    const result = previous.then(work);
    const settled = result.then(
      () => undefined,
      () => undefined,
    );
    queues.set(name, settled);
    try {
      return await result;
    } finally {
      waiting.set(name, (waiting.get(name) ?? 1) - 1);
    }
  };

  return {
    exclusive,
    async tryExclusive<T>(name: string, work: () => Promise<T>): Promise<T | undefined> {
      return (waiting.get(name) ?? 0) > 0 ? undefined : exclusive(name, work);
    },
  };
}

/** The part of the browser's `LockManager` that is used. */
export interface LockManagerLike {
  request<T>(
    name: string,
    options: { readonly ifAvailable?: boolean },
    callback: (lock: object | null) => Promise<T>,
  ): Promise<T>;
}

/** Locks across all tabs of the browser (Web Locks). */
export function webLocker(manager: LockManagerLike): Locker {
  return {
    exclusive: (name, work) => manager.request(name, {}, () => work()),
    tryExclusive: (name, work) =>
      manager.request(name, { ifAvailable: true }, (lock) =>
        lock === null ? Promise.resolve(undefined) : work(),
      ),
  };
}

/** Web Locks if the browser has them, else locks inside the tab. */
export function browserLocker(
  manager: LockManagerLike | undefined = (globalThis.navigator as { locks?: LockManagerLike })
    ?.locks,
): Locker {
  return manager === undefined ? memoryLocker() : webLocker(manager);
}
