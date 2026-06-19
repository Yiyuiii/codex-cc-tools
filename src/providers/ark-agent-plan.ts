export const ARK_AGENT_PLAN_BASE_URL = "https://ark.cn-beijing.volces.com/api/plan";
export const ARK_AGENT_PLAN_DEFAULT_MODEL = "glm-5.2";

export function resolveArkAgentPlanModel(requestedModel: string): string {
  const normalized = requestedModel.trim();
  const normalizedLower = normalized.toLowerCase();
  if (normalizedLower === "opus" || normalizedLower === "sonnet" || normalizedLower === "haiku") {
    return ARK_AGENT_PLAN_DEFAULT_MODEL;
  }

  if (normalizedLower === ARK_AGENT_PLAN_DEFAULT_MODEL) {
    return ARK_AGENT_PLAN_DEFAULT_MODEL;
  }

  return normalized;
}
