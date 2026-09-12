export function actionError(error: unknown, fallback = "Request failed"): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export function requireValue<T>(
  value: T | null | undefined,
  message: string,
): T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}
