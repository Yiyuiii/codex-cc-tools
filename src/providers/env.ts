import type { ProviderProfileName } from "./registry.js";
import {
  DEEPSEEK_ALLOWED_MODEL_INPUTS,
  DEEPSEEK_BASE_URL,
  DEEPSEEK_FLASH_MODEL,
  DEEPSEEK_PRO_MODEL,
  resolveDeepSeekModel
} from "./deepseek.js";
import { resolveAnthropicModel } from "./anthropic.js";

export type ClaudeEffort = "low" | "medium" | "high" | "max";
export type CacheTtl = "5m" | "1h";

export interface BuildProviderEnvironmentInput {
  provider: ProviderProfileName;
  model: string;
  effort: ClaudeEffort;
  cacheTtl: CacheTtl;
  sourceEnv?: Record<string, string | undefined>;
}

export interface ProviderEnvironmentResult {
  ok: boolean;
  provider: ProviderProfileName;
  model: string;
  env: Record<string, string>;
  redactions: string[];
  diagnostics?: string[];
  error?: string;
}

const PROVIDER_ENV_BLOCKLIST = [
  "DEEPSEEK_API_KEY",
  "OPENAI_API_KEY_DEEPSEEK",
  "DEEPSEEK_ANTHROPIC_BASE_URL",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_BASE_URL",
  "ANTHROPIC_MODEL",
  "ANTHROPIC_SMALL_FAST_MODEL",
  "ANTHROPIC_DEFAULT_OPUS_MODEL",
  "ANTHROPIC_DEFAULT_SONNET_MODEL",
  "ANTHROPIC_DEFAULT_HAIKU_MODEL",
  "ANTHROPIC_CUSTOM_HEADERS",
  "ANTHROPIC_BEDROCK_AUTH_TOKEN",
  "ANTHROPIC_BEDROCK_BASE_URL",
  "ANTHROPIC_VERTEX_AUTH_TOKEN",
  "ANTHROPIC_VERTEX_BASE_URL",
  "CLAUDE_CODE_SUBAGENT_MODEL",
  "CLAUDE_CODE_USE_BEDROCK",
  "CLAUDE_CODE_USE_VERTEX",
  "CLAUDE_CODE_SKIP_BEDROCK_AUTH",
  "CLAUDE_CODE_SKIP_VERTEX_AUTH"
] as const;

const PROVIDER_ENV_PREFIX_BLOCKLIST = [
  "CLOUD_ML_"
] as const;

const PROVIDER_ENV_NAME_PATTERNS = [
  /^AWS_.*(KEY|SECRET|TOKEN|CREDENTIAL)/,
  /^AMAZON_.*(KEY|SECRET|TOKEN|CREDENTIAL)/,
  /^GOOGLE_.*(KEY|SECRET|TOKEN|CREDENTIAL)/
] as const;

export function buildProviderEnvironment(
  input: BuildProviderEnvironmentInput
): ProviderEnvironmentResult {
  const sourceEnv = normalizeEnv(input.sourceEnv ?? process.env);
  const baseEnv = {
    ...sourceEnv,
    ENABLE_PROMPT_CACHING_1H: input.cacheTtl === "1h" ? "1" : "0"
  };

  if (input.provider === "anthropic") {
    return {
      ok: true,
      provider: input.provider,
      model: resolveAnthropicModel(input.model),
      env: baseEnv,
      redactions: inheritedAnthropicRedactions(baseEnv)
    };
  }

  const model = resolveDeepSeekModel(input.model);
  if (!model) {
    return {
      ok: false,
      provider: input.provider,
      model: input.model,
      env: baseEnv,
      redactions: [],
      error: `Unsupported model "${input.model}" for provider deepseek. Use one of: ${DEEPSEEK_ALLOWED_MODEL_INPUTS.join(", ")}.`
    };
  }

  const deepSeekToken = sourceEnv.DEEPSEEK_API_KEY?.trim();
  const fallbackToken = sourceEnv.OPENAI_API_KEY_DEEPSEEK?.trim();
  const token = deepSeekToken || fallbackToken;
  const tokenSource = deepSeekToken ? "DEEPSEEK_API_KEY" : "OPENAI_API_KEY_DEEPSEEK";
  const redactions = [deepSeekToken, fallbackToken].filter(
    (value): value is string => Boolean(value)
  );
  if (!token) {
    return {
      ok: false,
      provider: input.provider,
      model,
      env: baseEnv,
      redactions: [],
      error:
        "DeepSeek provider profile requires DEEPSEEK_API_KEY or OPENAI_API_KEY_DEEPSEEK in the environment."
    };
  }

  const baseUrl = resolveDeepSeekBaseUrl(sourceEnv.DEEPSEEK_ANTHROPIC_BASE_URL);
  if (!baseUrl.ok) {
    return {
      ok: false,
      provider: input.provider,
      model,
      env: baseEnv,
      redactions,
      error: baseUrl.error
    };
  }

  return {
    ok: true,
    provider: input.provider,
    model,
    env: {
      ...omitProviderRouteEnv(baseEnv),
      ANTHROPIC_BASE_URL: baseUrl.url,
      ANTHROPIC_AUTH_TOKEN: token,
      ANTHROPIC_MODEL: DEEPSEEK_PRO_MODEL,
      ANTHROPIC_DEFAULT_OPUS_MODEL: DEEPSEEK_PRO_MODEL,
      ANTHROPIC_DEFAULT_SONNET_MODEL: DEEPSEEK_PRO_MODEL,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: DEEPSEEK_FLASH_MODEL,
      ANTHROPIC_SMALL_FAST_MODEL: DEEPSEEK_FLASH_MODEL,
      CLAUDE_CODE_SUBAGENT_MODEL: DEEPSEEK_FLASH_MODEL,
      CLAUDE_CODE_EFFORT_LEVEL: input.effort,
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1"
    },
    redactions,
    diagnostics: [deepSeekRouteDiagnostic(baseUrl.url, tokenSource)]
  };
}

function normalizeEnv(env: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined)
  );
}

function inheritedAnthropicRedactions(env: Record<string, string>): string[] {
  return [
    env.ANTHROPIC_AUTH_TOKEN,
    env.ANTHROPIC_API_KEY,
    env.ANTHROPIC_BEDROCK_AUTH_TOKEN,
    env.ANTHROPIC_VERTEX_AUTH_TOKEN,
    env.AWS_ACCESS_KEY_ID,
    env.AWS_SECRET_ACCESS_KEY,
    env.AWS_SESSION_TOKEN,
    env.GOOGLE_APPLICATION_CREDENTIALS
  ].filter((value): value is string => Boolean(value));
}

function omitProviderRouteEnv(env: Record<string, string>): Record<string, string> {
  const result = { ...env };

  for (const key of Object.keys(result)) {
    if (PROVIDER_ENV_BLOCKLIST.includes(key as (typeof PROVIDER_ENV_BLOCKLIST)[number])) {
      delete result[key];
      continue;
    }

    if (PROVIDER_ENV_PREFIX_BLOCKLIST.some((prefix) => key.startsWith(prefix))) {
      delete result[key];
      continue;
    }

    if (PROVIDER_ENV_NAME_PATTERNS.some((pattern) => pattern.test(key))) {
      delete result[key];
    }
  }

  return result;
}

type BaseUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

function resolveDeepSeekBaseUrl(override: string | undefined): BaseUrlResult {
  const candidate = (override?.trim() || DEEPSEEK_BASE_URL);

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" || !url.hostname) {
      return {
        ok: false,
        error:
          "DEEPSEEK_ANTHROPIC_BASE_URL must be an https URL with a non-empty host when provided."
      };
    }
    return { ok: true, url: url.toString().replace(/\/$/, "") };
  } catch {
    return {
      ok: false,
      error:
        "DEEPSEEK_ANTHROPIC_BASE_URL must be a valid https URL with a non-empty host when provided."
    };
  }
}

function deepSeekRouteDiagnostic(baseUrl: string, tokenSource: string): string {
  const host = new URL(baseUrl).host;
  return `DeepSeek route target: ${host}; token source: ${tokenSource}.`;
}
