export function createIdempotencyKey(scope: string) {
  const normalizedScope = scope.trim() || "operation";

  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${normalizedScope}-${crypto.randomUUID()}`;
  }

  return `${normalizedScope}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}
