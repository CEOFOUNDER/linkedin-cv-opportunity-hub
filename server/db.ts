import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createHash } from "node:crypto";
import { InsertUser, searchCriteria, users, vacancies, verifiedEvidence } from "../drizzle/schema";
import { VERIFIED_CV_EVIDENCE } from "./verifiedEvidence";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await requireDb();
  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await requireDb();
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

const parseArray = (value: string) => {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
};

export const decodeCriteria = (row: typeof searchCriteria.$inferSelect) => ({
  ...row,
  targetTitles: parseArray(row.targetTitles),
  remotePreferences: parseArray(row.remotePreferences),
  employmentTypes: parseArray(row.employmentTypes),
  targetSectors: parseArray(row.targetSectors),
  exclusions: parseArray(row.exclusions),
});

export async function getCriteria(userId: number) {
  const db = await requireDb();
  const result = await db.select().from(searchCriteria).where(eq(searchCriteria.userId, userId)).limit(1);
  return result[0] ? decodeCriteria(result[0]) : null;
}

export async function saveCriteria(userId: number, input: {
  targetTitles: string[]; location: string; remotePreferences: string[]; employmentTypes: string[];
  compensationThreshold: string; compensationCurrency: string; targetSectors: string[]; exclusions: string[];
}) {
  const db = await requireDb();
  const value = {
    userId,
    targetTitles: JSON.stringify(input.targetTitles),
    location: input.location,
    remotePreferences: JSON.stringify(input.remotePreferences),
    employmentTypes: JSON.stringify(input.employmentTypes),
    compensationThreshold: input.compensationThreshold,
    compensationCurrency: input.compensationCurrency,
    targetSectors: JSON.stringify(input.targetSectors),
    exclusions: JSON.stringify(input.exclusions),
  };
  await db.insert(searchCriteria).values(value).onDuplicateKeyUpdate({ set: { ...value, updatedAt: new Date() } });
  return getCriteria(userId);
}

const evidenceHash = (claim: string) => createHash("sha256").update(claim).digest("hex");

export async function ensureVerifiedEvidence(userId: number) {
  const db = await requireDb();
  for (const item of VERIFIED_CV_EVIDENCE) {
    const contentHash = evidenceHash(item.claim);
    await db.insert(verifiedEvidence).values({
      userId,
      category: item.category,
      claim: item.claim,
      keywords: JSON.stringify(item.keywords),
      contentHash,
      isActive: 1,
    }).onDuplicateKeyUpdate({ set: { category: item.category, claim: item.claim, keywords: JSON.stringify(item.keywords), isActive: 1 } });
  }
}

export async function listVerifiedEvidence(userId: number) {
  const db = await requireDb();
  const records = await db.select().from(verifiedEvidence).where(and(eq(verifiedEvidence.userId, userId), eq(verifiedEvidence.isActive, 1))).orderBy(desc(verifiedEvidence.createdAt));
  return records.map(record => ({ ...record, keywords: parseArray(record.keywords) }));
}

export async function listVacancies(userId: number) {
  const db = await requireDb();
  return db.select().from(vacancies).where(eq(vacancies.userId, userId)).orderBy(desc(vacancies.updatedAt));
}

export async function getVacancy(userId: number, id: number) {
  const db = await requireDb();
  const result = await db.select().from(vacancies).where(and(eq(vacancies.userId, userId), eq(vacancies.id, id))).limit(1);
  return result[0];
}

export async function getVacancyBySourceHash(userId: number, sourceHash: string) {
  const db = await requireDb();
  const result = await db.select().from(vacancies).where(and(eq(vacancies.userId, userId), eq(vacancies.sourceHash, sourceHash))).limit(1);
  return result[0];
}

export async function createVacancy(userId: number, input: {
  linkedinUrl: string; normalizedUrl: string; sourceHash: string; title: string; employer: string; location: string;
  description: string; notes?: string; deadline?: Date | null;
}) {
  const db = await requireDb();
  const result = await db.insert(vacancies).values({ userId, ...input, stage: "Captured", notes: input.notes ?? null, deadline: input.deadline ?? null });
  const id = Number(result[0].insertId);
  return getVacancy(userId, id);
}

export async function updateVacancy(userId: number, id: number, fields: {
  stage?: "Captured" | "Review" | "Approved" | "Applied" | "Archived";
  fitScore?: number | null; fitRationale?: string | null; matchedRequirements?: string | null; unsupportedGaps?: string | null;
  tailoringBrief?: string | null; supportingDraft?: string | null; notes?: string | null; deadline?: Date | null;
  linkedinHandoffConfirmed?: number; linkedinHandoffConfirmedAt?: Date | null;
  applicationConfirmed?: number; applicationConfirmedAt?: Date | null;
}) {
  const db = await requireDb();
  await db.update(vacancies).set({ ...fields, updatedAt: new Date() }).where(and(eq(vacancies.userId, userId), eq(vacancies.id, id)));
  return getVacancy(userId, id);
}
