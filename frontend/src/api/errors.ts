function hasJsonResponse(
  error: unknown,
): error is { response: { json: () => Promise<unknown> } } {
  if (typeof error !== "object" || error === null) return false
  const response = (error as { response?: unknown }).response
  if (typeof response !== "object" || response === null) return false
  return typeof (response as { json?: unknown }).json === "function"
}

export async function apiErrorMessage(
  error: unknown,
  fallback: string,
): Promise<string | null> {
  if (!hasJsonResponse(error)) return null

  try {
    const data = await error.response.json()
    if (typeof data !== "object" || data === null) return fallback
    const detail = (data as { detail?: unknown }).detail
    return typeof detail === "string" && detail ? detail : fallback
  } catch {
    return fallback
  }
}
