import { TRPCError } from "@trpc/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { publicReviewerRouter } from "./routers/publicReviewer";
import {
  createVacancy, ensureVerifiedEvidence, getCriteria, getVacancy, getVacancyBySourceHash,
  listVacancies, listVerifiedEvidence, saveCriteria, updateVacancy,
} from "./db";
import {
  PIPELINE_STAGES, analyseVacancy, buildSupportingDraft, buildTailoringBrief, extractRoleDetails,
  isAllowedStageMove, isSafeJobSiteUrl, normalizeSourceUrl, type PipelineStage,
} from "./jobSearch";

const stages = z.enum(PIPELINE_STAGES);
const handoffConfirmationPhrase = "I am ready to review this application manually on the original job site";
const confirmationPhrase = "I confirmed this application manually on the original job site";

function personalUser(ctx: { user: { id: number; openId: string } | null }) {
  if (!ctx.user || ctx.user.openId !== ENV.ownerOpenId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "This personal dashboard is restricted to its owner." });
  }
  return ctx.user.id;
}

async function preparePersonalWorkspace(ctx: { user: { id: number; openId: string } | null }) {
  const userId = personalUser(ctx);
  await ensureVerifiedEvidence(userId);
  return userId;
}

async function ownedVacancy(userId: number, id: number) {
  const vacancy = await getVacancy(userId, id);
  if (!vacancy) throw new TRPCError({ code: "NOT_FOUND", message: "Vacancy not found." });
  return vacancy;
}

export const appRouter = router({
  system: systemRouter,
  reviewer: publicReviewerRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  jobSearch: router({
    overview: protectedProcedure.query(async ({ ctx }) => {
      const userId = await preparePersonalWorkspace(ctx);
      const [criteria, evidence, items] = await Promise.all([getCriteria(userId), listVerifiedEvidence(userId), listVacancies(userId)]);
      return { criteria, evidence, items, handoffConfirmationPhrase, confirmationPhrase };
    }),
    criteria: protectedProcedure.query(async ({ ctx }) => getCriteria(await preparePersonalWorkspace(ctx))),
    saveCriteria: protectedProcedure.input(z.object({
      targetTitles: z.array(z.string().trim().min(1)).max(20),
      location: z.string().trim().max(255),
      remotePreferences: z.array(z.string().trim().min(1)).max(5),
      employmentTypes: z.array(z.string().trim().min(1)).max(10),
      compensationThreshold: z.string().trim().max(100),
      compensationCurrency: z.string().trim().min(1).max(8),
      targetSectors: z.array(z.string().trim().min(1)).max(20),
      exclusions: z.array(z.string().trim().min(1)).max(20),
    })).mutation(async ({ ctx, input }) => saveCriteria(await preparePersonalWorkspace(ctx), input)),
    capture: protectedProcedure.input(z.object({
      sourceUrl: z.string().trim().max(2048).refine(isSafeJobSiteUrl, "Use a valid public HTTP(S) job-site URL without embedded credentials."),
      description: z.string().trim().min(30).max(60000),
      title: z.string().trim().max(255).optional(),
      employer: z.string().trim().max(255).optional(),
      location: z.string().trim().max(255).optional(),
      notes: z.string().trim().max(5000).optional(),
      deadline: z.string().datetime().optional(),
    })).mutation(async ({ ctx, input }) => {
      const userId = await preparePersonalWorkspace(ctx);
      const normalizedUrl = normalizeSourceUrl(input.sourceUrl);
      const sourceHash = createHash("sha256").update(normalizedUrl).digest("hex");
      const duplicate = await getVacancyBySourceHash(userId, sourceHash);
      if (duplicate) return { duplicate: true, vacancy: duplicate };
      const details = extractRoleDetails(input.description, input.title, input.employer, input.location);
      const vacancy = await createVacancy(userId, {
        sourceUrl: input.sourceUrl,
        normalizedUrl,
        sourceHash,
        ...details,
        description: input.description,
        notes: input.notes,
        deadline: input.deadline ? new Date(input.deadline) : null,
      });
      return { duplicate: false, vacancy };
    }),
    analyse: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const userId = await preparePersonalWorkspace(ctx);
      const vacancy = await ownedVacancy(userId, input.id);
      const evidence = await listVerifiedEvidence(userId);
      const analysis = analyseVacancy(vacancy.description, evidence);
      return updateVacancy(userId, vacancy.id, {
        fitScore: analysis.score,
        fitRationale: analysis.rationale,
        matchedRequirements: JSON.stringify(analysis.matches),
        unsupportedGaps: JSON.stringify(analysis.gaps),
      });
    }),
    updateDetails: protectedProcedure.input(z.object({
      id: z.number().int().positive(), notes: z.string().trim().max(5000), deadline: z.string().datetime().nullable(),
    })).mutation(async ({ ctx, input }) => {
      const userId = await preparePersonalWorkspace(ctx);
      await ownedVacancy(userId, input.id);
      return updateVacancy(userId, input.id, { notes: input.notes || null, deadline: input.deadline ? new Date(input.deadline) : null });
    }),
    moveStage: protectedProcedure.input(z.object({ id: z.number().int().positive(), stage: stages })).mutation(async ({ ctx, input }) => {
      const userId = await preparePersonalWorkspace(ctx);
      const vacancy = await ownedVacancy(userId, input.id);
      if (input.stage === "Applied" || !isAllowedStageMove(vacancy.stage as PipelineStage, input.stage)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "That stage change is not permitted. Applied requires a manual confirmation." });
      }
      return updateVacancy(userId, vacancy.id, { stage: input.stage });
    }),
    prepareMaterials: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const userId = await preparePersonalWorkspace(ctx);
      const vacancy = await ownedVacancy(userId, input.id);
      if (vacancy.stage !== "Approved") throw new TRPCError({ code: "BAD_REQUEST", message: "Only Approved roles can receive preparation materials." });
      const evidence = await listVerifiedEvidence(userId);
      const analysis = analyseVacancy(vacancy.description, evidence);
      return updateVacancy(userId, vacancy.id, {
        fitScore: analysis.score,
        fitRationale: analysis.rationale,
        matchedRequirements: JSON.stringify(analysis.matches),
        unsupportedGaps: JSON.stringify(analysis.gaps),
        tailoringBrief: buildTailoringBrief(vacancy.title, vacancy.employer, analysis),
        supportingDraft: buildSupportingDraft(vacancy.title, vacancy.employer, analysis),
      });
    }),
    confirmHandoff: protectedProcedure.input(z.object({ id: z.number().int().positive(), confirmation: z.string() })).mutation(async ({ ctx, input }) => {
      const userId = await preparePersonalWorkspace(ctx);
      const vacancy = await ownedVacancy(userId, input.id);
      if (vacancy.stage !== "Approved") throw new TRPCError({ code: "BAD_REQUEST", message: "Only Approved roles can open a manual external-site handoff." });
      if (input.confirmation !== handoffConfirmationPhrase) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "The external-site handoff confirmation phrase must match exactly." });
      }
      return updateVacancy(userId, vacancy.id, { externalHandoffConfirmed: 1, externalHandoffConfirmedAt: new Date() });
    }),
    confirmApplied: protectedProcedure.input(z.object({ id: z.number().int().positive(), confirmation: z.string() })).mutation(async ({ ctx, input }) => {
      const userId = await preparePersonalWorkspace(ctx);
      const vacancy = await ownedVacancy(userId, input.id);
      if (vacancy.stage !== "Approved") throw new TRPCError({ code: "BAD_REQUEST", message: "Only Approved roles can be marked as Applied." });
      if (!vacancy.externalHandoffConfirmed) throw new TRPCError({ code: "BAD_REQUEST", message: "Confirm the manual external-site handoff before recording an application." });
      if (input.confirmation !== confirmationPhrase) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "The manual confirmation phrase must match exactly." });
      }
      return updateVacancy(userId, vacancy.id, { stage: "Applied", applicationConfirmed: 1, applicationConfirmedAt: new Date() });
    }),
  }),
});

export type AppRouter = typeof appRouter;
