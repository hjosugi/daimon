import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { type Post, searchPosts, suggestPOVs } from "../../api/client"
import { createQueryClientWrapper } from "../../test/queryClient"
import { POV_CONSTRAINTS } from "../../types/constants"
import { useSearchController } from "./useSearchController"

vi.mock("../../api/client", () => ({
  searchPosts: vi.fn(),
  suggestPOVs: vi.fn(),
}))

const mockedSearchPosts = vi.mocked(searchPosts)
const mockedSuggestPOVs = vi.mocked(suggestPOVs)

const searchPost: Post = {
  id: "post-1",
  text: "search result",
  povs: ["Exact POV"],
}

describe("useSearchController", () => {
  beforeEach(() => {
    mockedSearchPosts.mockResolvedValue([searchPost])
    mockedSuggestPOVs.mockResolvedValue(["Exact POV"])
  })

  it("adds, deduplicates, removes, and clears tags", () => {
    const onTagsChange = vi.fn()
    const onPOVTooLong = vi.fn()
    const initialTags = ["initial"]
    const { wrapper } = createQueryClientWrapper()
    const { result } = renderHook(
      () =>
        useSearchController({
          initialTags,
          onTagsChange,
          onPOVTooLong,
        }),
      { wrapper },
    )

    expect(result.current.searchTags).toEqual(["initial"])

    act(() => {
      result.current.addSearchTag("  new  ")
      result.current.addSearchTag("new")
      result.current.removeSearchTag("initial")
    })

    expect(result.current.searchTags).toEqual(["new"])

    act(() => {
      result.current.clearTags()
    })

    expect(result.current.searchTags).toEqual([])
    expect(onPOVTooLong).not.toHaveBeenCalled()
  })

  it("caps tag input length and reports too-long tags", () => {
    const onPOVTooLong = vi.fn()
    const { wrapper } = createQueryClientWrapper()
    const { result } = renderHook(
      () =>
        useSearchController({
          initialTags: [],
          onPOVTooLong,
        }),
      { wrapper },
    )

    act(() => {
      result.current.setSearchTagInputValue(
        `#${"x".repeat(POV_CONSTRAINTS.MAX_LENGTH + 5)}`,
      )
    })

    expect(result.current.searchTagInput).toHaveLength(
      POV_CONSTRAINTS.MAX_LENGTH,
    )

    act(() => {
      result.current.addSearchTag("x".repeat(POV_CONSTRAINTS.MAX_LENGTH + 1))
    })

    expect(result.current.searchTags).toEqual([])
    expect(onPOVTooLong).toHaveBeenCalledTimes(1)
  })

  it("debounces search calls and can promote an exact suggestion to a POV tag", async () => {
    const { wrapper } = createQueryClientWrapper()
    const { result } = renderHook(
      () =>
        useSearchController({
          initialTags: [],
          onPOVTooLong: vi.fn(),
        }),
      { wrapper },
    )

    act(() => {
      result.current.setSearchQuery("  exact pov  ")
    })

    await waitFor(() => {
      expect(mockedSuggestPOVs).toHaveBeenCalledWith("exact pov")
      expect(mockedSearchPosts).toHaveBeenCalledWith({
        query: "exact pov",
        tags: undefined,
      })
      expect(result.current.posts).toEqual([searchPost])
    })

    let promoted = false
    act(() => {
      promoted = result.current.addQueryAsPOVIfExact()
    })

    expect(promoted).toBe(true)
    expect(result.current.searchTags).toEqual(["Exact POV"])
    expect(result.current.showPOVSearch).toBe(true)
    expect(result.current.searchQuery).toBe("")
  })
})
