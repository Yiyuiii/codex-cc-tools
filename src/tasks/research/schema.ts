import { z } from "zod";

import { ProviderProfileSchema } from "../../providers/registry.js";
import { CacheTtlSchema, ClaudeEffortSchema } from "../review/schema.js";

const NonEmptyStringSchema = z.string().trim().min(1);

const StringListSchema = z
  .preprocess((value) => {
    if (typeof value === "string") {
      const items = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      return items.length ? items : undefined;
    }

    return value;
  }, z.array(NonEmptyStringSchema).optional())
  .transform((value) => (value?.length ? value : undefined))
  .optional();

export const CcResearchInputSchema = z
  .object({
    question: NonEmptyStringSchema,
    cwd: NonEmptyStringSchema.optional(),
    context: z.string().trim().optional(),
    includeGitStatus: z.boolean().default(false),
    includeFiles: StringListSchema,
    providerProfile: ProviderProfileSchema.default("anthropic"),
    model: NonEmptyStringSchema.default("opus"),
    effort: ClaudeEffortSchema.default("max"),
    maxContextChars: z.number().int().min(1_000).max(1_000_000).default(120_000),
    stream: z.boolean().default(true),
    cacheTtl: CacheTtlSchema.default("1h")
  })
  .strict();

export const CcResearchStatusSchema = z.enum(["answered", "partial", "blocked"]);

export const CcResearchEvidenceSchema = z.object({
  file: z.string().optional(),
  command: z.string().optional(),
  detail: z.string()
});

export const CcResearchStructuredSchema = z.object({
  status: CcResearchStatusSchema,
  answer: z.string(),
  evidence: z.array(CcResearchEvidenceSchema).default([]),
  filesRead: z.array(z.string()).default([]),
  commandsRun: z.array(z.string()).default([]),
  missingContext: z.array(z.string()).default([])
});

export const CcResearchOutputSchema = CcResearchStructuredSchema.extend({
  ok: z.boolean(),
  model: z.string(),
  elapsedMs: z.number().int().nonnegative(),
  command: z.array(z.string()),
  eventsTail: z.array(z.string()).optional(),
  transcriptTail: z.array(z.string()).optional(),
  eventCount: z.number().int().nonnegative().optional(),
  diagnostics: z.array(z.string()).optional(),
  stderrTail: z.string().optional(),
  exitCode: z.number().int().optional()
});

export type CcResearchInput = z.output<typeof CcResearchInputSchema>;
export type CcResearchStructured = z.infer<typeof CcResearchStructuredSchema>;
export type CcResearchOutput = z.infer<typeof CcResearchOutputSchema>;
