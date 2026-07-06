import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest configuration with three projects:
 * - unit: pure domain functions, no DB
 * - procedure: tRPC procedure tests via createCaller, no DB
 * - integration: real Postgres via testcontainers
 *
 * Per constitution v2.0.0 Principle IV: integration tests MUST hit a real
 * Postgres container, mocking the DB is forbidden.
 */
export default defineConfig({
  plugins: [
    {
      name: "path-alias",
      config: () => ({
        resolve: {
          alias: {
            "@/": `${path.resolve(__dirname, "src")}/`,
            "server-only": path.resolve(
              __dirname,
              "src/tests/mocks/server-only.ts"
            ),
          },
        },
      }),
    },
  ],
  test: {
    environment: "node",
    setupFiles: ["./src/tests/setup.ts"],
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/tests/unit/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "procedure",
          include: ["src/tests/procedure/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["src/tests/integration/**/*.test.ts"],
          setupFiles: ["./src/tests/integration-setup.ts"],
        },
      },
    ],
  },
});
