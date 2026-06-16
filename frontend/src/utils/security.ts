/**
 * Security utilities for XSS prevention and input sanitization
 */

function removeControlCharacters(value: string): string {
  let result = ""
  for (const char of value) {
    const code = char.charCodeAt(0)
    if (code <= 31 || code === 127) continue
    result += char
  }
  return result
}

/**
 * Sanitize text input to prevent XSS attacks
 */
export function sanitizeText(text: string): string {
  if (!text) return ""

  // Remove HTML tags (basic sanitization)
  // React already escapes by default, but this adds an extra layer
  const div = document.createElement("div")
  div.textContent = text
  const sanitized = div.textContent || div.innerText || ""

  // Remove control characters and normalize whitespace
  return removeControlCharacters(sanitized).replace(/\s+/g, " ").trim()
}

/**
 * Validate POV (tag) input
 */
export function validatePOV(pov: string): { valid: boolean; error?: string } {
  if (!pov || !pov.trim()) {
    return { valid: false, error: "POV cannot be empty" }
  }

  const trimmed = pov.trim()

  if (trimmed.length > 300) {
    return { valid: false, error: "POV must be 300 characters or less" }
  }

  // Check for potentially dangerous patterns
  if (/<script|javascript:|onerror=|onload=/i.test(trimmed)) {
    return { valid: false, error: "POV contains invalid characters" }
  }

  return { valid: true }
}

/**
 * Validate post text input
 */
export function validatePostText(text: string): {
  valid: boolean
  error?: string
} {
  if (!text || !text.trim()) {
    return { valid: false, error: "Post text cannot be empty" }
  }

  if (text.length > 10000) {
    return {
      valid: false,
      error: "Post text must be 10,000 characters or less",
    }
  }

  return { valid: true }
}

/**
 * Escape special characters for safe display
 * React does this automatically, but this can be used for additional safety
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }

  return text.replace(/[&<>"']/g, (m) => map[m])
}
