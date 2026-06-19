export const ARK_CODING_PLAN_BASE_URL = "https://ark.cn-beijing.volces.com/api/coding";
export const ARK_CODING_PLAN_DEFAULT_MODEL = "ark-code-latest";

const ARK_CODING_PLAN_LEGACY_GLM_MODEL = "glm-latest";
const ARK_CODING_PLAN_LEGACY_DEFAULT_MODEL = "doubao-seed-2.0-pro";

export function resolveArkCodingPlanModel(requestedModel: string): string {
  const normalized = requestedModel.trim();
  const normalizedLower = normalized.toLowerCase();
  if (normalizedLower === "opus" || normalizedLower === "sonnet" || normalizedLower === "haiku") {
    return ARK_CODING_PLAN_DEFAULT_MODEL;
  }

  if (
    normalizedLower === ARK_CODING_PLAN_DEFAULT_MODEL ||
    normalizedLower === ARK_CODING_PLAN_LEGACY_GLM_MODEL ||
    normalizedLower === ARK_CODING_PLAN_LEGACY_DEFAULT_MODEL
  ) {
    return ARK_CODING_PLAN_DEFAULT_MODEL;
  }

  return normalized;
}
