export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function stringifyArguments(value: Record<string, unknown> | undefined): string {
  return JSON.stringify(value ?? {}, null, 2);
}
