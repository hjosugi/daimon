export const POV_CONSTRAINTS = {
  MAX_LENGTH: 300,
  MAX_COUNT: 100,
} as const

export const PROFILE_CONSTRAINTS = {
  BIO_MAX_LENGTH: 160,
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
  SEARCH_QUERY: 250,
  SEARCH_POV_INPUT: 200,
} as const
