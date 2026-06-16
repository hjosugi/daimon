import type { MatchReason } from "../api/client"
import type { TranslationKey } from "../i18n"

type Translate = (
  key: TranslationKey,
  values?: Record<string, string | number>,
) => string

const reasonKeys: Record<string, TranslationKey> = {
  bridge_shared_values: "post.reason.bridgeShared",
  shared_values: "post.reason.sharedValues",
  near_sense: "post.reason.nearSense",
  new_perspective: "post.reason.newPerspective",
}

function reasonPOVs(matchReason: MatchReason): string {
  const povs =
    matchReason.pov_matches?.length > 0
      ? matchReason.pov_matches
      : (matchReason.common_povs ?? [])
  return povs
    .slice(0, 3)
    .map((pov) => `#${pov}`)
    .join(" ")
}

function legacyReasonKey(reason: string): TranslationKey | null {
  if (reason.startsWith("遠い視点・共通の価値観")) {
    return "post.reason.bridgeShared"
  }
  if (reason.startsWith("共通の価値観")) {
    return "post.reason.sharedValues"
  }
  if (reason === "あなたの感性に近い") {
    return "post.reason.nearSense"
  }
  if (reason === "新しい視点") {
    return "post.reason.newPerspective"
  }
  return null
}

export function formatMatchReason(
  matchReason: MatchReason,
  t: Translate,
): string | null {
  const povs = reasonPOVs(matchReason)
  const reason = matchReason.reason

  if (reason) {
    const key = reasonKeys[reason] ?? legacyReasonKey(reason)
    if (key) return t(key, { povs })
    return reason
  }

  if (povs) {
    return t("post.commonPovReason", { povs })
  }
  return null
}
