/**
 * Integration-test setup. The DB container must start before test modules are
 * imported because integration suites import the app-level Drizzle singleton at
 * module scope.
 */
import { afterAll } from "vitest";
import { startTestDb, stopTestDb } from "@/tests/helpers/db";

Object.assign(process.env, {
  BETTER_AUTH_SECRET: "test-secret-at-least-16-bytes",
  BETTER_AUTH_URL: "http://localhost:3000",
  NODE_ENV: "test",
});

const testDb = await startTestDb();

afterAll(async () => {
  await stopTestDb(testDb);
});
