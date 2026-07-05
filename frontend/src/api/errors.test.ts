import { describe, expect, it, vi } from "vitest"
import { apiErrorMessage, errorMessage, localizedErrorMessage } from "./errors"

describe("api error helpers", () => {
  it("extracts JSON response details when available", async () => {
    await expect(
      apiErrorMessage(
        {
          response: {
            json: vi.fn().mockResolvedValue({ detail: "Post not found" }),
          },
        },
        "fallback",
      ),
    ).resolves.toBe("Post not found")
  })

  it("falls back for malformed JSON responses and ignores non-response errors", async () => {
    await expect(
      apiErrorMessage(
        {
          response: {
            json: vi.fn().mockResolvedValue({ detail: "" }),
          },
        },
        "fallback",
      ),
    ).resolves.toBe("fallback")

    await expect(apiErrorMessage(new Error("boom"), "fallback")).resolves.toBe(
      null,
    )
  })

  it("prefers structured detail before generic messages", () => {
    expect(
      errorMessage(
        { response: { data: { detail: "Invalid credentials" } } },
        "fallback",
      ),
    ).toBe("Invalid credentials")

    expect(errorMessage(new Error("network failed"), "fallback")).toBe(
      "network failed",
    )
    expect(errorMessage({}, "fallback")).toBe("fallback")
  })

  it("localizes known server messages and preserves unknown messages", () => {
    const t = vi.fn((key) => `translated:${key}`)

    expect(
      localizedErrorMessage(
        { response: { data: { detail: "Invalid credentials" } } },
        "fallback",
        t,
      ),
    ).toBe("translated:api.invalidCredentials")

    expect(localizedErrorMessage(new Error("custom"), "fallback", t)).toBe(
      "custom",
    )
    expect(localizedErrorMessage({}, "fallback", t)).toBe("fallback")
  })
})
