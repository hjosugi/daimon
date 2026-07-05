import { describe, expect, it } from "vitest"
import { sanitizeText } from "./security"

describe("sanitizeText", () => {
  it("returns an empty string for empty input", () => {
    expect(sanitizeText("")).toBe("")
  })

  it("removes control characters and normalizes whitespace", () => {
    expect(sanitizeText("  hello \u0000\t\n world\u007f  ")).toBe("hello world")
  })

  it("keeps markup as text instead of parsing it as HTML", () => {
    expect(sanitizeText("<img src=x onerror=alert(1)>   ok")).toBe(
      "<img src=x onerror=alert(1)> ok",
    )
  })
})
