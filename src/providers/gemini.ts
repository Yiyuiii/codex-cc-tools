export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
export const GEMINI_FLASH_MODEL = "gemini-3.5-flash";

export const GEMINI_API_KEY_ENV_NAMES = [
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY"
] as const;

export function resolveGeminiModel(requestedModel: string): string {
  const normalized = requestedModel.trim();
  const withoutModelsPrefix = normalized.startsWith("models/")
    ? normalized.slice("models/".length)
    : normalized;

  if (
    withoutModelsPrefix === "opus" ||
    withoutModelsPrefix === "sonnet" ||
    withoutModelsPrefix === "haiku"
  ) {
    return GEMINI_FLASH_MODEL;
  }

  return withoutModelsPrefix;
}
