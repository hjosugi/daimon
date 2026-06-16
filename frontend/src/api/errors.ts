import type { TranslationKey } from "../i18n"

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

const serverErrorKeys: Record<string, TranslationKey> = {
  "Invalid JSON body": "api.invalidJsonBody",
  "Username cannot be empty": "api.usernameCannotBeEmpty",
  "Username must be 30 characters or less": "api.usernameTooLong",
  "Username contains invalid characters": "api.usernameInvalid",
  "Email cannot be empty": "api.emailCannotBeEmpty",
  "Email is too long": "api.emailTooLong",
  "Invalid email format": "api.emailInvalid",
  "Password cannot be empty": "api.passwordCannotBeEmpty",
  "Password must be at least 8 characters": "api.passwordTooShort",
  "Password must be 72 bytes or less": "api.passwordTooLong",
  "Bio must be 160 characters or less": "api.bioTooLong",
  "Bio contains invalid characters": "api.bioInvalid",
  "Database error": "api.databaseError",
  "Invalid or expired token": "api.invalidToken",
  "Post not found": "api.postNotFound",
  "User not found": "api.userNotFound",
  "POV is required": "api.povRequired",
  "Comment cannot be empty": "api.commentCannotBeEmpty",
  "Comment is too long": "api.commentTooLong",
  "Post text cannot be empty": "api.postTextCannotBeEmpty",
  "Username already exists": "api.usernameExists",
  "Email already exists": "api.emailExists",
  "Invalid credentials": "api.invalidCredentials",
  "Could not create post": "api.createPostFailed",
  "Could not save POV": "api.savePovFailed",
  "Could not commit": "api.commitFailed",
  "Could not delete post": "api.deletePostFailed",
  "Could not add comment": "api.addCommentFailed",
  "Could not hash password": "api.hashPasswordFailed",
  "Could not create user": "api.createUserFailed",
  "Could not create session": "api.createSessionFailed",
  "Could not update profile": "api.updateProfileFailed",
  "Could not delete account": "api.deleteAccountFailed",
}

function messageFromError(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null

  const candidate = error as {
    message?: unknown
    response?: { data?: { detail?: unknown } }
  }
  const detail = candidate.response?.data?.detail
  if (typeof detail === "string" && detail) return detail
  if (typeof candidate.message === "string" && candidate.message) {
    return candidate.message
  }
  return null
}

export function errorMessage(error: unknown, fallback: string): string {
  return messageFromError(error) ?? fallback
}

export function localizedErrorMessage(
  error: unknown,
  fallback: string,
  t: (key: TranslationKey) => string,
): string {
  const message = messageFromError(error)
  if (!message) return fallback
  const key = serverErrorKeys[message]
  return key ? t(key) : message
}
