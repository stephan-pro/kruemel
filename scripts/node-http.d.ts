// Minimal typing of the one Node module the fake server uses, instead of @types/node (N7: no
// dependency for a test helper). Only what `fake-server.ts` calls.
declare module "node:http" {
  export interface IncomingMessage {
    readonly method?: string;
    readonly url?: string;
    readonly headers: Readonly<Record<string, string | string[] | undefined>>;
    on(event: "data", listener: (chunk: { toString(): string }) => void): void;
    on(event: "end" | "close", listener: () => void): void;
  }

  export interface ServerResponse {
    writeHead(status: number, headers?: Readonly<Record<string, string>>): void;
    write(chunk: string): void;
    end(body?: string): void;
  }

  export function createServer(
    handler: (request: IncomingMessage, response: ServerResponse) => void,
  ): {
    listen(port: number, listening?: () => void): void;
  };
}
