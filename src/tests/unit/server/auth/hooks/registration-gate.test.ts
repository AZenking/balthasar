import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * T005: registration-gate unit tests (TDD red → green).
 *
 * Covers three branches per spec.md FR-024 / FR-025 / research.md Q1:
 *  1. user table empty            → before hook resolves (registration allowed)
 *  2. user table populated + ALLOW_REGISTRATION != "true" → throws REGISTRATION_CLOSED
 *  3. user table populated + ALLOW_REGISTRATION == "true" → resolves (admin reopen)
 *
 * No real DB. `db.$count` and `env.ALLOW_REGISTRATION` are mocked via vi.hoisted
 * (factories are hoisted above imports, so they cannot reference closure vars
 * declared at module top — vi.hoisted bridges that gap).
 */
const { mockCount, envState } = vi.hoisted(() => ({
  mockCount: vi.fn(async () => 0),
  envState: { ALLOW_REGISTRATION: "false" },
}));

vi.mock("@/server/db/client", () => ({
  db: {
    $count: mockCount,
  },
}));

vi.mock("@/lib/env", () => ({
  env: envState,
}));

import { registrationGate } from "@/server/auth/hooks/registration-gate";

describe("registrationGate.user.create.before", () => {
  beforeEach(() => {
    mockCount.mockReset();
    envState.ALLOW_REGISTRATION = "false";
  });

  it("allows registration when user table is empty (first user = admin)", async () => {
    mockCount.mockResolvedValue(0);
    await expect(
      registrationGate.user.create.before({ id: "u1", email: "a@b.c" })
    ).resolves.toBeUndefined();
    expect(mockCount).toHaveBeenCalledOnce();
  });

  it("rejects registration when users exist and ALLOW_REGISTRATION is not 'true'", async () => {
    mockCount.mockResolvedValue(1);
    await expect(
      registrationGate.user.create.before({ id: "u2", email: "b@b.c" })
    ).rejects.toThrow(/REGISTRATION_CLOSED/);
  });

  it("allows registration when users exist but ALLOW_REGISTRATION='true'", async () => {
    mockCount.mockResolvedValue(3);
    envState.ALLOW_REGISTRATION = "true";
    await expect(
      registrationGate.user.create.before({ id: "u4", email: "c@b.c" })
    ).resolves.toBeUndefined();
  });
});
