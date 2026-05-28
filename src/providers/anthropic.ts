export const ANTHROPIC_OPUS_MODEL = "claude-opus-4-8";

export function resolveAnthropicModel(requestedModel: string): string {
  if (requestedModel === "opus") {
    return ANTHROPIC_OPUS_MODEL;
  }

  return requestedModel;
}
