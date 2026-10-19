// The service worker: keeps the app's own files on the device, so it opens and works without
// internet (N3) and the installed app starts at once. The data is not handled here; it lives in
// the browser storage and never leaves the device.
//
// The build (`serviceWorker()` in vite.config.ts) emits this file as `sw.js` and fills in
// `__BUILD_INFO__`: the list of all files of the build (hashed names) and a version derived from
// them. A new build means a new version, so the browser installs the new worker, which keeps the
// new files and drops the old ones.

const sw = self as unknown as ServiceWorkerGlobalScope;

interface BuildInfo {
  readonly version: string;
  /** Paths relative to the app's address, e.g. "assets/index-abc123.js"; "index.html" is the page. */
  readonly files: readonly string[];
}

const build: BuildInfo = JSON.parse("__BUILD_INFO__");

const CACHE_PREFIX = "putzplan-";
const CACHE = `${CACHE_PREFIX}${build.version}`;
/** The app's address, e.g. "https://example.org/putzplan/"; the page itself is kept under it. */
const SCOPE = sw.registration.scope;
/** How long a page may take online before the kept copy is used (a bad connection is not offline). */
const NAVIGATION_TIMEOUT_MS = 4000;

/**
 * How a kept file is looked up. `ignoreVary`: a page asks for a script or style with an `Origin`
 * header (`crossorigin`), the copy was fetched without one; a server that answers `Vary: Origin`
 * would make the copy not match and the app would not start without internet.
 */
const MATCH: MultiCacheQueryOptions = { cacheName: CACHE, ignoreVary: true };

function addressOf(file: string): string {
  return file === "index.html" ? SCOPE : new URL(file, SCOPE).href;
}

async function keepFiles(): Promise<void> {
  const cache = await caches.open(CACHE);
  // "reload": ask the server, not the browser's own cache, so a half-old mix cannot get in.
  await cache.addAll(build.files.map((file) => new Request(addressOf(file), { cache: "reload" })));
}

async function dropOldCaches(): Promise<void> {
  const names = await caches.keys();
  await Promise.all(
    names
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE)
      .map((name) => caches.delete(name)),
  );
}

/** The page: from the server when it answers in time (so updates arrive), otherwise the kept copy. */
async function page(request: Request): Promise<Response> {
  try {
    return await new Promise<Response>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout")), NAVIGATION_TIMEOUT_MS);
      fetch(request).then(
        (response) => {
          clearTimeout(timer);
          resolve(response);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  } catch {
    return (await caches.match(SCOPE, MATCH)) ?? Response.error();
  }
}

/** Everything else (scripts, styles, fonts, icons): the kept copy first; its name has a hash. */
async function file(request: Request): Promise<Response> {
  return (await caches.match(request, MATCH)) ?? fetch(request);
}

sw.addEventListener("install", (event) => {
  // The new worker takes over at once; the files are all there before it does.
  event.waitUntil(keepFiles().then(() => sw.skipWaiting()));
});

sw.addEventListener("activate", (event) => {
  event.waitUntil(dropOldCaches().then(() => sw.clients.claim()));
});

sw.addEventListener("fetch", (event) => {
  const { request } = event;
  const address = new URL(request.url);
  // Only what belongs to the app: GET requests to its own address. Downloads of backups are
  // `blob:` addresses and never get here.
  if (
    request.method !== "GET" ||
    address.origin !== sw.location.origin ||
    !address.href.startsWith(SCOPE)
  ) {
    return;
  }
  event.respondWith(request.mode === "navigate" ? page(request) : file(request));
});
