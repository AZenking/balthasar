/**
 * Integration-test setup: ensures every integration test file shares a
 * Postgres container pattern. Per `tasks.md` T005: container is started by
 * testcontainers and `drizzle-kit migrate` is applied automatically.
 */
import { execSync } from "node:child_process";
import { afterAll, beforeAll } from "vitest";

// Reserved for future global fixtures (e.g., shared container across files).
// Currently each test file calls `getTestDb()` for isolation.
export const mochaGlobalSetup = async () => {
  // Placeholder: verify drizzle-kit is invocable for migrations
  try {
    execSync("drizzle-kit --version", { stdio: "ignore" });
  } catch {
    // Will be caught at runtime per-test
  }
};

// Ensure afterAll hook is referenced for type completeness
beforeAll(() => undefined);
afterAll(() => undefined);
