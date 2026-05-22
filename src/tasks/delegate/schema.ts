import { z } from "zod";

import { ProviderProfileSchema } from "../../providers/registry.js";
import { CacheTtlSchema, ClaudeEffortSchema } from "../review/schema.js";

const NonEmptyStringSchema = z.string().trim().min(1);

const StringListSchema = z
  .preprocess((value) => {
    if (typeof value === "string") {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return value;
  }, z.array(NonEmptyStringSchema).optional())
  .transform((value) => (value?.length ? value : undefined))
  .optional();

const SimpleCommandSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine(
    (value) => !value.includes(","),
    "commandsAllowed entries must be passed as separate command arguments, not comma-separated strings"
  )
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

const OptionalCommandListSchema = z
  .preprocess((value) => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed ? [trimmed] : [];
    }
    return value;
  }, z.array(SimpleCommandSchema).optional())
  .transform((value) => (value?.length ? value : undefined))
  .optional();

export const DelegateIsolationSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("git-worktree"),
      branch: NonEmptyStringSchema.optional(),
      headSha: NonEmptyStringSchema.optional(),
      acceptDetached: z.boolean().optional(),
      acceptDirty: z.boolean().optional()
    })
    .strict(),
  z
    .object({
      kind: z.literal("git-branch"),
      branch: NonEmptyStringSchema,
      headSha: NonEmptyStringSchema.optional(),
      acceptDirty: z.boolean().optional(),
      acknowledgeSharedCheckout: z.literal(true)
    })
    .strict(),
  z
    .object({
      kind: z.literal("container"),
      containerId: NonEmptyStringSchema,
      image: NonEmptyStringSchema.optional(),
      workspaceMount: NonEmptyStringSchema,
      writableRoot: NonEmptyStringSchema,
      acknowledgeUnverifiableHostBoundary: z.literal(true)
    })
    .strict()
]);

export const CcDelegateInputSchema = z
  .object({
    task: NonEmptyStringSchema,
    cwd: NonEmptyStringSchema,
    isolation: DelegateIsolationSchema,
    acceptanceCriteria: z.array(NonEmptyStringSchema).min(1),
    context: z.string().trim().optional(),
    allowedPaths: StringListSchema,
    forbiddenPaths: StringListSchema,
    commandsAllowed: OptionalCommandListSchema,
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
  "partial",
  "needs_followup",
  "blocked"
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

export type DelegateIsolation = z.infer<typeof DelegateIsolationSchema>;
export type CcDelegateInput = z.output<typeof CcDelegateInputSchema>;
export type CcDelegateStructured = z.infer<typeof CcDelegateStructuredSchema>;
export type CcDelegateOutput = z.infer<typeof CcDelegateOutputSchema>;
