// enum constants
export enum MatchType {
  TAG = "tag",
  BOTH = "both",
}

export enum QueryKey {
  TIMELINE = "timeline",
  SEARCH = "search",
  COMMENTS = "comments",
}

export enum POVType {
  AUTO_GENERATED = "auto_generated",
  MANUAL = "manual",
}

export enum ModalType {
  DELETE_CONFIRM = "delete_confirm",
  MATCH_DETAILS = "match_details",
  MATCH_REASON_DETAILS = "match_reason_details",
}

export const POV_CONSTRAINTS = {
  MAX_LENGTH: 300,
  MAX_COUNT: 100,
} as const

export const POST_CONSTRAINTS = {
  // Long-form by design: deep, ErogameScape-style posts that argue a 観点 (POV)
  // in depth rather than one-liners. Embeddings cover the whole post (chunked).
  MAX_TEXT_LENGTH: 40000,
  MIN_TEXT_LENGTH: 1,
} as const

export const DEBOUNCE_DELAYS = {
  POV_GENERATION: 800,
  POV_SUGGESTION: 300,
} as const
