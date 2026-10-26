// Texts that are looked up when they are read, not when they are created. A constant such as
// `ACCOUNT_TEXTS` or `AUTH_MESSAGES` is made once, but the language can change afterwards; with
// these helpers every read gives the text of the language that is set at that moment.

/**
 * An object that reads from `current()` on every access: `texts.title` is the title in the
 * language set now. Only reading is supported (the dictionaries are not changed).
 */
export function liveObject<T extends object>(current: () => T): Readonly<T> {
  return new Proxy({} as T, {
    get: (_target, key) => Reflect.get(current(), key),
    has: (_target, key) => Reflect.has(current(), key),
    ownKeys: () => Reflect.ownKeys(current()),
    getOwnPropertyDescriptor: (_target, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(current(), key);
      // A proxy may only report properties its target has, unless they can be configured.
      return descriptor === undefined ? undefined : { ...descriptor, configurable: true };
    },
  });
}

/** A record with one text per key; each read gives the text in the language set now. */
export function liveTexts<K extends string>(
  keys: readonly K[],
  read: (key: K) => string,
): Readonly<Record<K, string>> {
  const texts = {} as Record<K, string>;
  for (const key of keys) {
    Object.defineProperty(texts, key, { enumerable: true, get: () => read(key) });
  }
  return texts;
}
