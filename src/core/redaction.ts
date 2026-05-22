const REDACTED_PROVIDER_TOKEN = "[REDACTED_PROVIDER_TOKEN]";

export function redactProviderSecrets(value: string, redactions: string[] = []): string {
  return redactions.reduce((current, secret) => {
    if (!secret) return current;
    return current.split(secret).join(REDACTED_PROVIDER_TOKEN);
  }, value);
}

export function redactProviderSecretsFromUnknown(
  value: unknown,
  redactions: string[] = []
): unknown {
  return redactValue(value, redactions, new WeakSet<object>());
}

function redactValue(value: unknown, redactions: string[], seen: WeakSet<object>): unknown {
  if (typeof value === "string") {
    return redactProviderSecrets(value, redactions);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, redactions, seen));
  }

  if (value instanceof Error) {
    return redactError(value, redactions, seen);
  }

  if (value && typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }
    seen.add(value);
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, redactValue(item, redactions, seen)])
    );
  }

  return value;
}

function redactError(error: Error, redactions: string[], seen: WeakSet<object>): unknown {
  if (seen.has(error)) {
    return "[Circular]";
  }
  seen.add(error);

  const result: Record<string, unknown> = {
    name: error.name,
    message: redactProviderSecrets(error.message, redactions)
  };

  if (error.stack) {
    result.stack = redactProviderSecrets(error.stack, redactions);
  }

  const maybeCause = error as Error & { cause?: unknown };
  if (maybeCause.cause !== undefined) {
    result.cause = redactValue(maybeCause.cause, redactions, seen);
  }

  return result;
}
