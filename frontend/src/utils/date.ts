import type { Locale } from "../i18n/resources"

const relativeFormatters: Record<Locale, Intl.RelativeTimeFormat> = {
  ja: new Intl.RelativeTimeFormat("ja", { numeric: "auto" }),
  en: new Intl.RelativeTimeFormat("en", { numeric: "auto" }),
}

const absoluteFormatters: Record<Locale, Intl.DateTimeFormat> = {
  ja: new Intl.DateTimeFormat("ja-JP", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }),
  en: new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }),
}

/**
 * Format date to relative time for recent dates, or absolute date for old dates.
 */
export function formatRelativeDate(
  date: Date | string,
  locale: Locale = "en",
): string {
  const now = Date.now()
  const targetDate = typeof date === "string" ? new Date(date) : date
  const targetTime = targetDate.getTime()

  if (Number.isNaN(targetTime)) return ""

  const diffSec = Math.round((targetTime - now) / 1000)
  const absSec = Math.abs(diffSec)
  const rtf = relativeFormatters[locale] ?? relativeFormatters.en

  if (absSec < 60) {
    return locale === "ja" ? "たった今" : "just now"
  }
  if (absSec < 60 * 60) {
    return rtf.format(Math.round(diffSec / 60), "minute")
  }
  if (absSec < 60 * 60 * 24) {
    return rtf.format(Math.round(diffSec / (60 * 60)), "hour")
  }
  if (absSec < 60 * 60 * 24 * 7) {
    return rtf.format(Math.round(diffSec / (60 * 60 * 24)), "day")
  }
  if (absSec < 60 * 60 * 24 * 30) {
    return rtf.format(Math.round(diffSec / (60 * 60 * 24 * 7)), "week")
  }
  if (absSec < 60 * 60 * 24 * 365) {
    return rtf.format(Math.round(diffSec / (60 * 60 * 24 * 30)), "month")
  }

  return (absoluteFormatters[locale] ?? absoluteFormatters.en).format(
    targetDate,
  )
}
