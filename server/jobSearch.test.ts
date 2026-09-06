import { describe, expect, it } from "vitest";
import { analyseVacancy, buildSupportingDraft, buildTailoringBrief, isAllowedStageMove, isDuplicateSource, isSafeJobSiteUrl, normalizeSourceUrl } from "./jobSearch";

const evidence = [
  { id: 1, category: "AI governance", claim: "Set AI governance principles for explainability, control and compliance.", keywords: ["ai governance", "explainability", "compliance", "controls"] },
  { id: 2, category: "Finance transformation", claim: "Led finance operating-model redesign and planning implementations.", keywords: ["finance transformation", "operating model", "planning"] },
];

describe("job-search safeguards", () => {
  it("normalises generic job-site URLs so tracking parameters do not bypass duplicate detection", () => {
    expect(normalizeSourceUrl("https://jobs.example.com/openings/123/?trackingId=abc&utm_source=search&jobId=42")).toBe("https://jobs.example.com/openings/123?jobId=42");
    expect(isDuplicateSource("recorded-source", "recorded-source")).toBe(true);
    expect(isDuplicateSource("recorded-source", "different-source")).toBe(false);
  });

  it("accepts public job-site URLs while rejecting unsafe or malformed destinations", () => {
    expect(isSafeJobSiteUrl("https://boards.greenhouse.io/example/jobs/123")).toBe(true);
    expect(isSafeJobSiteUrl("https://example.com/jobs/view/123")).toBe(true);
    expect(isSafeJobSiteUrl("https://user:password@example.com/jobs/123")).toBe(false);
    expect(isSafeJobSiteUrl("http://localhost/jobs/123")).toBe(false);
    expect(isSafeJobSiteUrl("not-a-url")).toBe(false);
  });

  it("identifies unsupported requirements as gaps rather than claims", () => {
    const analysis = analyseVacancy("You will lead AI governance and finance transformation. You must hold a medical degree and manage clinical trials.", evidence);
    expect(analysis.matches.length).toBeGreaterThan(0);
    expect(analysis.gaps.join(" ")).toMatch(/medical degree|clinical trials/i);
  });

  it("keeps unsupported requirements out of the supporting-material draft", () => {
    const analysis = analyseVacancy("You will lead AI governance. You must hold a medical degree.", evidence);
    const draft = buildSupportingDraft("Director", "Example Co", analysis);
    expect(draft).not.toMatch(/medical degree/i);
    expect(buildTailoringBrief("Director", "Example Co", analysis)).toMatch(/Do not claim:.*medical degree/i);
  });

  it("prevents direct movement into Applied", () => {
    expect(isAllowedStageMove("Approved", "Applied")).toBe(false);
    expect(isAllowedStageMove("Review", "Approved")).toBe(true);
  });
});
