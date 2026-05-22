import { z } from "zod";

import { resolveAnthropicModel } from "./anthropic.js";
import { DEEPSEEK_FLASH_MODEL, resolveDeepSeekModel } from "./deepseek.js";

export const ProviderProfileSchema = z.enum(["anthropic", "deepseek"]);
export type ProviderProfileName = z.infer<typeof ProviderProfileSchema>;

export interface ProviderProfileDefinition {
  name: ProviderProfileName;
  role: string;
  // Provider-level status reflects currently implemented task surfaces.
  // Add task-scoped gate metadata before using this flag to imply future task coverage.
  experimental: boolean;
}

export interface ResolvedProviderProfile {
  provider: ProviderProfileName;
  model: string;
  subagentModel?: string;
  experimental: boolean;
}

const PROVIDERS: ProviderProfileDefinition[] = [
  {
    name: "anthropic",
    role: "default Claude Code provider",
    experimental: false
  },
  {
    name: "deepseek",
    role: "DeepSeek Anthropic-compatible Claude Code provider",
    experimental: false
  }
];

export function getProviderProfiles(): ProviderProfileDefinition[] {
  return PROVIDERS.map((provider) => ({ ...provider }));
}

export function resolveProviderProfile(
  provider: ProviderProfileName,
  requestedModel: string
): ResolvedProviderProfile {
  if (provider === "anthropic") {
    return {
      provider,
      model: resolveAnthropicModel(requestedModel),
      experimental: false
    };
  }

  return {
    provider,
    model: resolveDeepSeekModel(requestedModel) ?? requestedModel,
    subagentModel: DEEPSEEK_FLASH_MODEL,
    experimental: false
  };
}
