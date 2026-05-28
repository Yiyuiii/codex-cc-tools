export const ARK_CODING_PLAN_BASE_URL = "https://ark.cn-beijing.volces.com/api/coding";
export const ARK_CODING_PLAN_PRO_MODEL = "doubao-seed-2.0-pro";

export function resolveArkCodingPlanModel(requestedModel: string): string {
  const normalized = requestedModel.trim();
  if (normalized === "opus" || normalized === "sonnet" || normalized === "haiku") {
    return ARK_CODING_PLAN_PRO_MODEL;
  }

  if (normalized.toLowerCase() === ARK_CODING_PLAN_PRO_MODEL) {
    return ARK_CODING_PLAN_PRO_MODEL;
  }

  return normalized;
}
