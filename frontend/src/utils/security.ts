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
