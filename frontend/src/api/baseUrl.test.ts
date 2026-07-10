import { describe, expect, it } from "vitest"
import { PRODUCTION_API_URL, resolveAPIBaseURL } from "./baseUrl"

describe("resolveAPIBaseURL", () => {
  it("uses the Go API in production", () => {
    expect(resolveAPIBaseURL(undefined, true)).toBe(PRODUCTION_API_URL)
  })

  it("keeps the local API default in development", () => {
    expect(resolveAPIBaseURL(undefined, false)).toBe("http://localhost:8000")
  })

  it("migrates the legacy FastAPI service URL", () => {
    expect(
      resolveAPIBaseURL(
        "https://daimon-629174432708.asia-northeast1.run.app/",
        true,
      ),
    ).toBe(PRODUCTION_API_URL)
  })

  it("preserves an explicit non-legacy URL", () => {
    expect(resolveAPIBaseURL("https://api.example.com/", true)).toBe(
      "https://api.example.com",
    )
  })
})
