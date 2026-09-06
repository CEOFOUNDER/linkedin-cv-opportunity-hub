export const PIPELINE_STAGES = ["Captured", "Review", "Approved", "Applied", "Archived"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export type EvidenceUnit = {
  id: number;
  category: string;
  claim: string;
  keywords: string[];
};

export type MatchedRequirement = {
  requirement: string;
  evidenceId: number;
  claim: string;
  category: string;
};

export type VacancyAnalysis = {
  score: number;
  rationale: string;
  requirements: string[];
  matches: MatchedRequirement[];
  gaps: string[];
};

const STOP_WORDS = new Set([
  "about", "across", "also", "and", "are", "between", "candidate", "company", "deliver", "for", "from", "have", "into", "must", "our", "role", "team", "that", "the", "their", "this", "through", "with", "will", "you", "your",
]);

function normaliseText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9£&+ ]/g, " ").replace(/\s+/g, " ").trim();
}

function keywordsFrom(value: string) {
  return normaliseText(value)
    .split(" ")
    .filter(token => token.length > 2 && !STOP_WORDS.has(token));
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

export function normalizeLinkedInUrl(url: string) {
  const parsed = new URL(url.trim());
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const path = parsed.pathname.replace(/\/+$/, "") || "/";
  return `https://${host}${path}`;
}

export function isLinkedInJobUrl(url: string) {
  try {
    const hostname = new URL(url.trim()).hostname.toLowerCase().replace(/^www\./, "");
    return hostname === "linkedin.com" || hostname.endsWith(".linkedin.com");
  } catch {
    return false;
  }
}

export function isDuplicateSource(existingSourceHash: string | undefined, candidateSourceHash: string) {
  return Boolean(existingSourceHash && existingSourceHash === candidateSourceHash);
}

export function extractRoleDetails(description: string, suppliedTitle?: string, suppliedEmployer?: string, suppliedLocation?: string) {
  const lines = description.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const labelled = (label: string) => lines.find(line => new RegExp(`^${label}\\s*[:\\-]`, "i").test(line))?.replace(new RegExp(`^${label}\\s*[:\\-]\\s*`, "i"), "");
  const firstLine = lines[0] ?? "Untitled vacancy";
  const atMatch = firstLine.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);

  return {
    title: suppliedTitle?.trim() || labelled("(?:job title|role|position)") || atMatch?.[1]?.trim() || firstLine.slice(0, 255),
    employer: suppliedEmployer?.trim() || labelled("(?:company|employer|organisation)") || atMatch?.[2]?.trim() || "Not specified",
    location: suppliedLocation?.trim() || labelled("location") || "Not specified",
  };
}

export function extractRequirements(description: string) {
  const lines = description
    .replace(/\r/g, "")
    .split(/\n|(?<=[.!?])\s+(?=[A-Z])/)
    .map(line => line.replace(/^[•\-*\d.\s]+/, "").trim())
    .filter(line => line.length >= 24 && line.length <= 360);
  const requirementPattern = /\b(require|requirement|must|experience|responsib|you will|ideal|seeking|lead|manage|develop|build|strategy|finance|transformation|governance|stakeholder)\b/i;
  return unique(lines.filter(line => requirementPattern.test(line))).slice(0, 12);
}

function matchStrength(requirement: string, evidence: EvidenceUnit) {
  const requirementText = normaliseText(requirement);
  const explicitHits = evidence.keywords.filter(keyword => requirementText.includes(normaliseText(keyword))).length;
  const requirementTokens = new Set(keywordsFrom(requirement));
  const evidenceTokens = unique([...evidence.keywords.flatMap(keywordsFrom), ...keywordsFrom(evidence.claim)]);
  const tokenHits = evidenceTokens.filter(token => requirementTokens.has(token)).length;
  return explicitHits * 4 + tokenHits;
}

export function analyseVacancy(description: string, evidence: EvidenceUnit[]): VacancyAnalysis {
  const requirements = extractRequirements(description);
  if (requirements.length === 0) {
    return {
      score: 0,
      rationale: "No clear requirements could be isolated from the pasted description. Review the vacancy manually before approving it.",
      requirements: [],
      matches: [],
      gaps: [],
    };
  }

  const matches: MatchedRequirement[] = [];
  const gaps: string[] = [];
  for (const requirement of requirements) {
    const ranked = evidence
      .map(item => ({ item, strength: matchStrength(requirement, item) }))
      .sort((a, b) => b.strength - a.strength);
    const best = ranked[0];
    if (!best || best.strength < 2) {
      gaps.push(requirement);
      continue;
    }
    matches.push({ requirement, evidenceId: best.item.id, claim: best.item.claim, category: best.item.category });
  }

  const score = Math.round((matches.length / requirements.length) * 100);
  const rationale = `${matches.length} of ${requirements.length} extracted requirements align with verified evidence. ${gaps.length} requirement${gaps.length === 1 ? " remains" : "s remain"} unsupported and will be excluded from application materials.`;
  return { score, rationale, requirements, matches, gaps };
}

export function buildTailoringBrief(title: string, employer: string, analysis: VacancyAnalysis) {
  const evidenceAnchors = unique(analysis.matches.map(match => match.claim)).slice(0, 6);
  const matchedTerms = unique(analysis.matches.map(match => match.requirement)).slice(0, 6);
  const gapLines = analysis.gaps.length > 0
    ? analysis.gaps.map(gap => `- Do not claim: ${gap}`).join("\n")
    : "- No unsupported requirement was identified by the rule-based review. Confirm every final claim against the source CV.";

  return [
    `TARGET ROLE: ${title} | ${employer}`,
    "",
    "PROFESSIONAL PROFILE FOCUS",
    "Use a concise UK-English profile anchored only in the verified evidence below. Prioritise the employer’s genuine terminology without copying the job advert.",
    "",
    "VERIFIED EVIDENCE ANCHORS",
    ...(evidenceAnchors.length ? evidenceAnchors.map(claim => `- ${claim}`) : ["- No verified evidence has been matched. Do not generate a tailored CV until the role is reviewed."]),
    "",
    "ROLE REQUIREMENTS TO ADDRESS",
    ...(matchedTerms.length ? matchedTerms.map(item => `- ${item}`) : ["- No supported requirement has been identified."]),
    "",
    "UNSUPPORTED REQUIREMENTS AND SAFEGUARD",
    gapLines,
    "",
    "ATS AND QUALITY CONTROL",
    "Use a conventional reverse-chronological UK CV with a factual profile, natural keyword use and evidence-led bullets. Do not invent an employer, client, metric, qualification, technology, title or outcome. Keep confidential AI-lab work unnamed.",
  ].join("\n");
}

export function buildSupportingDraft(title: string, employer: string, analysis: VacancyAnalysis) {
  const claims = unique(analysis.matches.map(match => match.claim)).slice(0, 3);
  const proof = claims.length
    ? claims.map(claim => `- ${claim}`).join("\n")
    : "- No factual evidence has been matched. Do not use this draft until the role is manually reviewed.";

  return [
    `SUPPORTING-MATERIAL DRAFT: ${title} | ${employer}`,
    "",
    `Dear Hiring Team,\n\nI am interested in the ${title} opportunity with ${employer}. The points below are selected solely from my verified career record and should be reviewed, edited and approved before use.`,
    "",
    "Relevant evidence",
    proof,
    "",
    "Safeguard",
    "This draft intentionally does not address any unsupported requirement. Add material only when you can verify it from your career record and are prepared to substantiate it in interview.",
    "",
    "Kind regards,\nGilles Bonelli FCCA",
  ].join("\n");
}

export function isAllowedStageMove(from: PipelineStage, to: PipelineStage) {
  const transitions: Record<PipelineStage, PipelineStage[]> = {
    Captured: ["Review", "Archived"],
    Review: ["Captured", "Approved", "Archived"],
    Approved: ["Review", "Archived"],
    Applied: ["Archived"],
    Archived: ["Review"],
  };
  return transitions[from].includes(to);
}
