const LOCAL_API_URL = "http://localhost:8000"

export const PRODUCTION_API_URL =
  "https://daimon-api-629174432708.asia-northeast1.run.app"

const LEGACY_PRODUCTION_API_URL =
  "https://daimon-629174432708.asia-northeast1.run.app"

export const resolveAPIBaseURL = (
  configuredURL: string | undefined,
  production: boolean,
) => {
  const configured = configuredURL?.replace(/\/+$/, "")
  if (configured === LEGACY_PRODUCTION_API_URL) return PRODUCTION_API_URL
  if (configured) return configured
  return production ? PRODUCTION_API_URL : LOCAL_API_URL
}
