/**
 * Helpers for levels.test.ts — separate module so vitest's vi.resetModules()
 * in the parent test forces `@/lib/logger` (and its env read) to re-evaluate
 * per NODE_ENV branch.
 */
import { Writable } from "node:stream";
import type { Logger } from "pino";
// ESM top-level import so the `@/` alias resolves under vitest's transform.
import { createLogger } from "@/lib/logger";

export interface TestSink extends Writable {
  lines: string[];
}

export function createLoggerForTest(): { log: Logger; sink: TestSink } {
  const sink: TestSink = Object.assign(new Writable({ decodeStrings: false }), {
    lines: [] as string[],
  });
  sink._write = (chunk: any, _enc, cb) => {
    const line = String(chunk);
    if (line) sink.lines.push(line);
    cb();
  };
  // Re-create logger with the same env-derived behaviour but our sink.
  // minLevel/pretty default to env-derived inside createLogger.
  const log = createLogger({ stream: sink });
  return { log, sink };
}

// Re-export so test file can opt to use the lazy env-sensitive singleton
// via fresh module reload when needed.
export { createLogger };
