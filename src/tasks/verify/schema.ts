import { z } from "zod";

import { ProviderProfileSchema } from "../../providers/registry.js";
import { CacheTtlSchema, ClaudeEffortSchema } from "../review/schema.js";

const NonEmptyStringSchema = z.string().trim().min(1);
const SimpleCommandSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine(
    (value) => !/[`()\r\n;&|<>]/.test(value),
    "commandsAllowed entries must be simple command allowlist patterns"
  )
  .refine(
    (value) => {
      const firstToken = value.split(/\s+/, 1)[0] ?? "";
      return /[A-Za-z0-9]/.test(firstToken) && !/[*?]/.test(firstToken);
    },
    "commandsAllowed entries must be simple command allowlist patterns"
  );

const CommandListSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  return value;
}, z.array(SimpleCommandSchema).min(1));

export const CcVerifyInputSchema = z
  .object({
    hypothesis: NonEmptyStringSchema,
    commandsAllowed: CommandListSchema,
    cwd: NonEmptyStringSchema.optional(),
    context: z.string().trim().optional(),
    providerProfile: ProviderProfileSchema.default("anthropic"),
    model: NonEmptyStringSchema.default("opus"),
    effort: ClaudeEffortSchema.default("max"),
    timeoutMs: z.number().int().positive().max(3_600_000).default(900_000),
    maxContextChars: z.number().int().min(1_000).max(1_000_000).default(120_000),
    stream: z.boolean().default(true),
    cacheTtl: CacheTtlSchema.default("1h")
  })
  .strict();

export const CcVerifyStatusSchema = z.enum([
  "verified",
  "reproduced",
  "not_reproduced",
  "partial",
  "blocked"
]);

export const CcVerifyCommandRunSchema = z.object({
  command: z.string(),
  exitCode: z.number().int().optional(),
  summary: z.string()
});

export const CcVerifyStructuredSchema = z.object({
  status: CcVerifyStatusSchema,
  summary: z.string(),
  commandsRun: z.array(CcVerifyCommandRunSchema).default([]),
  evidence: z.array(z.string()).default([]),
  reproduction: z.string().default(""),
  needsFollowup: z.boolean().default(false),
  diagnostics: z.array(z.string()).default([])
});

export const CcVerifyOutputSchema = CcVerifyStructuredSchema.extend({
  ok: z.boolean(),
  model: z.string(),
  elapsedMs: z.number().int().nonnegative(),
  command: z.array(z.string()),
  eventsTail: z.array(z.string()).optional(),
  transcriptTail: z.array(z.string()).optional(),
  eventCount: z.number().int().nonnegative().optional(),
  stderrTail: z.string().optional(),
  exitCode: z.number().int().optional()
});

export type CcVerifyInput = z.output<typeof CcVerifyInputSchema>;
export type CcVerifyStructured = z.infer<typeof CcVerifyStructuredSchema>;
export type CcVerifyOutput = z.infer<typeof CcVerifyOutputSchema>;
