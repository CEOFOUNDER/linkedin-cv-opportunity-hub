import { index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["admin", "user"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const pipelineStages = ["Captured", "Review", "Approved", "Applied", "Archived"] as const;

export const searchCriteria = mysqlTable(
  "search_criteria",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    targetTitles: text("targetTitles").notNull(),
    location: varchar("location", { length: 255 }).notNull().default(""),
    remotePreferences: text("remotePreferences").notNull(),
    employmentTypes: text("employmentTypes").notNull(),
    compensationThreshold: varchar("compensationThreshold", { length: 100 }).notNull().default(""),
    compensationCurrency: varchar("compensationCurrency", { length: 8 }).notNull().default("GBP"),
    targetSectors: text("targetSectors").notNull(),
    exclusions: text("exclusions").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ userUnique: uniqueIndex("search_criteria_user_unique").on(table.userId) }),
);

export const verifiedEvidence = mysqlTable(
  "verified_evidence",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    category: varchar("category", { length: 120 }).notNull(),
    claim: text("claim").notNull(),
    keywords: text("keywords").notNull(),
    contentHash: varchar("contentHash", { length: 64 }).notNull(),
    isActive: int("isActive").notNull().default(1),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    userEvidence: index("verified_evidence_user_idx").on(table.userId),
    userClaim: uniqueIndex("verified_evidence_user_claim_unique").on(table.userId, table.contentHash),
  }),
);

export const vacancies = mysqlTable(
  "vacancies",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    // Physical column name is retained solely to preserve existing records; the application treats this as a generic external source URL.
    sourceUrl: varchar("linkedinUrl", { length: 2048 }).notNull(),
    normalizedUrl: varchar("normalizedUrl", { length: 2048 }).notNull(),
    sourceHash: varchar("sourceHash", { length: 64 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    employer: varchar("employer", { length: 255 }).notNull().default("Not specified"),
    location: varchar("location", { length: 255 }).notNull().default("Not specified"),
    description: text("description").notNull(),
    stage: mysqlEnum("stage", pipelineStages).notNull().default("Captured"),
    fitScore: int("fitScore"),
    fitRationale: text("fitRationale"),
    matchedRequirements: text("matchedRequirements"),
    unsupportedGaps: text("unsupportedGaps"),
    tailoringBrief: text("tailoringBrief"),
    supportingDraft: text("supportingDraft"),
    notes: text("notes"),
    deadline: timestamp("deadline"),
    // Physical names are retained for backwards-compatible storage; the workflow is no longer LinkedIn-specific.
    externalHandoffConfirmed: int("linkedinHandoffConfirmed").notNull().default(0),
    externalHandoffConfirmedAt: timestamp("linkedinHandoffConfirmedAt"),
    applicationConfirmed: int("applicationConfirmed").notNull().default(0),
    applicationConfirmedAt: timestamp("applicationConfirmedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    userStage: index("vacancies_user_stage_idx").on(table.userId, table.stage),
    userSource: uniqueIndex("vacancies_user_source_unique").on(table.userId, table.sourceHash),
  }),
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Vacancy = typeof vacancies.$inferSelect;
export type VerifiedEvidence = typeof verifiedEvidence.$inferSelect;
