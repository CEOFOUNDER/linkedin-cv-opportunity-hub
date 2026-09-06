import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const llmMocks = vi.hoisted(() => ({ invokeLLM: vi.fn() }));
vi.mock("./_core/llm", () => llmMocks);

import { appRouter } from "./routers";

function publicContext(): TrpcContext {
  return {
    user: null,
    req: { headers: {}, ip: "203.0.113.20" } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const cvText = "Finance leader with experience establishing governance, controls and finance operating-model redesign across complex organisations.";
const jobText = "Lead a finance transformation programme and establish robust governance controls across the function and its stakeholders.";

describe("reviewer.analyse", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns structured evidence-led review output without requiring an authenticated session", async () => {
    llmMocks.invokeLLM.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
      fitScore: 72,
      summary: "The supplied CV directly supports the governance and transformation aspects of the role.",
      matchedRequirements: [{ requirement: "Lead finance transformation", evidenceQuote: "finance operating-model redesign", explanation: "This exact CV phrase supports the transformation requirement." }],
      unsupportedGaps: ["No direct evidence of managing the stated team size."],
      tailoringDirections: ["Use the quoted operating-model redesign evidence only after personal review."],
      safetyNote: "Do not claim unsupported leadership scope.",
    }) } }] });
    const result = await appRouter.createCaller(publicContext()).reviewer.analyse({ cvText, jobText, sourceUrl: "https://careers.example.com/jobs/123" });

    expect(result).toMatchObject({ fitScore: 72, sourceUrl: "https://careers.example.com/jobs/123" });
    expect(llmMocks.invokeLLM).toHaveBeenCalledWith(expect.objectContaining({ model: "gpt-5-mini" }));
  });

  it("rejects unsafe external URLs before invoking the comparison service", async () => {
    await expect(appRouter.createCaller(publicContext()).reviewer.analyse({ cvText, jobText, sourceUrl: "http://localhost/private-job" })).rejects.toThrow("public HTTP(S) URL");
    expect(llmMocks.invokeLLM).not.toHaveBeenCalled();
  });
});
