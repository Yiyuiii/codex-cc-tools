import { z } from "zod";

import { ProviderProfileSchema } from "../../providers/registry.js";
import { CacheTtlSchema, ClaudeEffortSchema } from "../review/schema.js";

const NonEmptyStringSchema = z.string().trim().min(1);

export const CcDelegateInputSchema = z
  .object({
    prompt: NonEmptyStringSchema,
    cwd: NonEmptyStringSchema.optional(),
    providerProfile: ProviderProfileSchema.default("anthropic"),
    model: NonEmptyStringSchema.default("opus"),
    effort: ClaudeEffortSchema.default("max"),
    timeoutMs: z.number().int().positive().max(3_600_000).default(900_000),
    maxContextChars: z.number().int().min(1_000).max(1_000_000).default(120_000),
    stream: z.boolean().default(true),
    cacheTtl: CacheTtlSchema.default("1h")
  })
  .strict();

export const CcDelegateStatusSchema = z.enum([
  "succeeded",
  "failed",
  "cancelled",
  "timed_out"
]);

export const CcDelegateCommandRunSchema = z.object({
  command: z.string(),
  exitCode: z.number().int().optional(),
  summary: z.string()
});

export const CcDelegateStructuredSchema = z.object({
  status: CcDelegateStatusSchema,
  summary: z.string(),
  filesChanged: z.array(z.string()).default([]),
  commandsRun: z.array(CcDelegateCommandRunSchema).default([]),
  verification: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  diagnostics: z.array(z.string()).default([])
});

export const CcDelegateOutputSchema = CcDelegateStructuredSchema.extend({
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

export type CcDelegateInput = z.output<typeof CcDelegateInputSchema>;
export type CcDelegateStructured = z.infer<typeof CcDelegateStructuredSchema>;
export type CcDelegateOutput = z.infer<typeof CcDelegateOutputSchema>;
