export const DEEPSEEK_BASE_URL = "https://api.deepseek.com/anthropic";
export const DEEPSEEK_PRO_MODEL = "deepseek-v4-pro[1m]";
export const DEEPSEEK_FLASH_MODEL = "deepseek-v4-flash";

export const DEEPSEEK_ALLOWED_MODEL_INPUTS = [
  "opus",
  "sonnet",
  "haiku",
  DEEPSEEK_PRO_MODEL,
  DEEPSEEK_FLASH_MODEL
] as const;

export function resolveDeepSeekModel(requestedModel: string): string | undefined {
  if (requestedModel === "haiku") {
    return DEEPSEEK_FLASH_MODEL;
  }

  if (requestedModel === "opus" || requestedModel === "sonnet") {
    return DEEPSEEK_PRO_MODEL;
  }

  if (requestedModel === DEEPSEEK_PRO_MODEL || requestedModel === DEEPSEEK_FLASH_MODEL) {
    return requestedModel;
  }

  return undefined;
}
