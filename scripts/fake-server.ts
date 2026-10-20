// The fake server of the end-to-end tests (stage 2): HTTP in front of `FakeServer`, which holds
// the households and follows the rules of the real database. Playwright starts it (see
// `playwright.config.ts`); a test creates a household with `POST /test/household` and hands the
// returned secrets to the browser. Built with `vite build --ssr` (`npm run build:e2e`) and run
// with Node, because the app's source files import each other without file endings.
//
//   GET  /health        ready check
//   POST /test/household  {data?} → {tokens: {personA, personB}}
//   GET  /pull?cursor=  what changed since (Authorization: Bearer <secret>)
//   POST /push          one change
//   GET  /events?token= server-sent events: "change" whenever the household data changed
//   GET  /test/data     the household's data as the server has them
//
// Test-only: no sign-in, wide-open CORS, nothing is kept after the process ends.

import { createServer, type IncomingMessage } from "node:http";
import { FakeServer } from "../src/sync/fakeServer";

declare const process: { env: Record<string, string | undefined> };

const port = Number(process.env.FAKE_SERVER_PORT ?? 4180);
const server = new FakeServer();

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function readBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    let text = "";
    request.on("data", (chunk) => {
      text += chunk.toString();
    });
    request.on("end", () => {
      try {
        resolve(text === "" ? undefined : JSON.parse(text));
      } catch {
        resolve(undefined);
      }
    });
  });
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  const method = request.method ?? "GET";

  if (method === "OPTIONS") {
    response.writeHead(204, CORS);
    response.end();
    return;
  }
  if (url.pathname === "/health") {
    response.writeHead(200, { ...CORS, "Content-Type": "text/plain" });
    response.end("ok");
    return;
  }
  if (method === "GET" && url.pathname === "/events") {
    const household = server.householdFor(url.searchParams.get("token") ?? undefined);
    if (household === undefined) {
      response.writeHead(401, CORS);
      response.end();
      return;
    }
    response.writeHead(200, {
      ...CORS,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    response.write(": connected\n\n");
    const stop = household.subscribe(() => response.write("event: change\ndata: {}\n\n"));
    request.on("close", stop);
    return;
  }

  const authorization = request.headers.authorization;
  const answer = server.handle({
    method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    token: typeof authorization === "string" ? authorization.replace(/^Bearer /, "") : undefined,
    body: method === "POST" ? await readBody(request) : undefined,
  });
  response.writeHead(answer.status, { ...CORS, "Content-Type": "application/json" });
  response.end(JSON.stringify(answer.body));
}).listen(port, () => {
  console.log(`Fake-Server läuft auf http://localhost:${port}`);
});
