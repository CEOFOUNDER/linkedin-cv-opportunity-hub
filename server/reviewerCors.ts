import type { Request } from "express";

export const GITHUB_PAGES_ORIGIN = "https://ceofounder.github.io";

export function isAllowedReviewerOrigin(req: Pick<Request, "get">, origin: string | undefined) {
  if (!origin) return true;
  if (origin === GITHUB_PAGES_ORIGIN) return true;
  try {
    return new URL(origin).host === req.get("host");
  } catch {
    return false;
  }
}
