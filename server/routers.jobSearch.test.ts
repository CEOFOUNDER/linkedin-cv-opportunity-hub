import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  createVacancy: vi.fn(),
  ensureVerifiedEvidence: vi.fn(),
  getCriteria: vi.fn(),
  getVacancy: vi.fn(),
  getVacancyBySourceHash: vi.fn(),
  listVacancies: vi.fn(),
  listVerifiedEvidence: vi.fn(),
  saveCriteria: vi.fn(),
  updateVacancy: vi.fn(),
}));

vi.mock("./db", () => dbMocks);

import { ENV } from "./_core/env";
import { appRouter } from "./routers";

function ownerContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: ENV.ownerOpenId,
      email: "owner@example.com",
      name: "Owner",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("jobSearch.capture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.ensureVerifiedEvidence.mockResolvedValue(undefined);
    dbMocks.getVacancyBySourceHash.mockResolvedValue(undefined);
  });

  it("rejects a non-LinkedIn source before it reaches the capture workflow", async () => {
    const caller = appRouter.createCaller(ownerContext());

    await expect(caller.jobSearch.capture({
      linkedinUrl: "https://example.com/jobs/123",
      description: "This role requires at least thirty characters of job-description text.",
    })).rejects.toThrow("Use a LinkedIn vacancy URL.");

    expect(dbMocks.ensureVerifiedEvidence).not.toHaveBeenCalled();
    expect(dbMocks.createVacancy).not.toHaveBeenCalled();
  });

  it("returns the existing record for a duplicate LinkedIn vacancy without creating another record", async () => {
    const caller = appRouter.createCaller(ownerContext());
    const existing = { id: 42, title: "Existing role" };
    dbMocks.getVacancyBySourceHash.mockResolvedValue(existing);

    const result = await caller.jobSearch.capture({
      linkedinUrl: "https://www.linkedin.com/jobs/view/123/?trackingId=abc",
      description: "This role requires at least thirty characters of job-description text.",
    });

    expect(result).toEqual({ duplicate: true, vacancy: existing });
    expect(dbMocks.getVacancyBySourceHash).toHaveBeenCalledTimes(1);
    expect(dbMocks.createVacancy).not.toHaveBeenCalled();
  });
});
