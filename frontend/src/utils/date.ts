/**
 * Format date to relative time (e.g., "2h ago", "3d ago") for recent dates,
 * or absolute date for older dates
 */
export function formatRelativeDate(date: Date | string): string {
  const now = new Date()
  const targetDate = typeof date === "string" ? new Date(date) : date
  const diffMs = now.getTime() - targetDate.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  const diffWeek = Math.floor(diffDay / 7)
  const diffMonth = Math.floor(diffDay / 30)
  const diffYear = Math.floor(diffDay / 365)

  if (diffSec < 60) {
    return "just now"
  } else if (diffMin < 60) {
    return `${diffMin}m ago`
  } else if (diffHour < 24) {
    return `${diffHour}h ago`
  } else if (diffDay < 7) {
    return `${diffDay}d ago`
  } else if (diffWeek < 4) {
    return `${diffWeek}w ago`
  } else if (diffMonth < 12) {
    return `${diffMonth}mo ago`
  } else if (diffYear < 1) {
    return `${diffYear}y ago`
  } else {
    // For dates older than 1 year, show absolute date
    return targetDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: targetDate.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    })
  }
}
