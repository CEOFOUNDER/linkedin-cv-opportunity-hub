import { describe, expect, it } from "vitest";
import { GITHUB_PAGES_ORIGIN, isAllowedReviewerOrigin } from "./reviewerCors";

const sameOriginRequest = { get: (header: string) => header === "host" ? "reviewer.manus.space" : undefined };

describe("isAllowedReviewerOrigin", () => {
  it("allows the configured GitHub Pages origin and same-origin requests", () => {
    expect(isAllowedReviewerOrigin(sameOriginRequest, GITHUB_PAGES_ORIGIN)).toBe(true);
    expect(isAllowedReviewerOrigin(sameOriginRequest, "https://reviewer.manus.space")).toBe(true);
  });

  it("rejects unconfigured cross-origin callers", () => {
    expect(isAllowedReviewerOrigin(sameOriginRequest, "https://untrusted.example")).toBe(false);
    expect(isAllowedReviewerOrigin(sameOriginRequest, "not a URL")).toBe(false);
  });
});
