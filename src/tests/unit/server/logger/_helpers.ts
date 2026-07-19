/**
 * Test helpers for logger unit tests.
 *
 * Wires pino to an in-memory sink so tests can parse JSON lines back and
 * assert exact fields — never reads stdout (which is flaky across platforms).
 *
 * Per research.md R8: tests inject a custom destination via pino's `stream`
 * option; production/dev use process.stdout.
 */
import { createLogger } from "@/lib/logger";
import type { Logger } from "pino";
import { Writable } from "node:stream";

export type CapturedRecord = Record<string, unknown> & {
  level: string;
  msg: string;
  time?: string;
};

export interface Sink extends Writable {
  lines: string[];
}

/**
 * Build a logger identical to production (same redact, timestamp, level
 * formatter) but with the destination replaced by an in-memory sink.
 *
 * `captured` will receive one parsed JSON object per log call.
 */
export function createTestLogger(captured: CapturedRecord[]): Logger {
  const sink: Sink = Object.assign(new Writable({ decodeStrings: false }), {
    lines: [] as string[],
  });
  sink._write = (chunk: any, _enc, cb) => {
    const line = String(chunk).trimEnd();
    if (line) {
      sink.lines.push(line);
      try {
        captured.push(JSON.parse(line) as CapturedRecord);
      } catch {
        // ignore non-JSON lines (e.g. pino-pretty output in some envs)
      }
    }
    cb();
  };

  return createLogger({ stream: sink, minLevel: "trace" });
}

/**
 * Thin wrapper that mirrors how production code calls the logger so tests
 * exercise the real serialization path.
 */
export function writeLog(
  log: Logger,
  payload: { level: "info" | "warn" | "error" | "debug"; msg: string } & Record<
    string,
    unknown
  >,
): void {
  const { level, msg, ...rest } = payload;
  log[level](rest, msg);
}
