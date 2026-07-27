import { useQuery } from "@tanstack/react-query"
import { useCallback, useEffect, useState } from "react"
import { searchPosts, suggestPOVs } from "../../api/client"
import { useDebouncedValue } from "../../hooks/useDebouncedValue"
import { DEBOUNCE_DELAYS, POV_CONSTRAINTS } from "../../types/constants"

interface UseSearchControllerOptions {
  initialTags: string[]
  onTagsChange?: (tags: string[]) => void
  onPOVTooLong: () => void
}

const sameTags = (left: string[], right: string[]) =>
  left.length === right.length &&
  left.every((tag, index) => tag === right[index])

export function useSearchController({
  initialTags,
  onTagsChange,
  onPOVTooLong,
}: UseSearchControllerOptions) {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchTags, setSearchTags] = useState<string[]>(initialTags)
  const [searchTagInput, setSearchTagInput] = useState("")
  const [showPOVSearch, setShowPOVSearch] = useState(false)
  const [sort, setSort] = useState<"relevance" | "newest">("relevance")

  const normalizedQuery = searchQuery.trim()
  const debouncedQuery = useDebouncedValue(
    searchQuery,
    DEBOUNCE_DELAYS.SEARCH_QUERY,
  ).trim()
  const debouncedPOVInput = useDebouncedValue(
    searchTagInput,
    DEBOUNCE_DELAYS.SEARCH_POV_INPUT,
  ).trim()

  const { data: queryPOVSuggestions = [] } = useQuery({
    queryKey: ["pov-suggest", debouncedQuery],
    queryFn: () => suggestPOVs(debouncedQuery),
    enabled: debouncedQuery.length > 0,
    staleTime: 1000 * 60 * 5,
  })

  const { data: inputPOVSuggestions = [] } = useQuery({
    queryKey: ["pov-suggest", debouncedPOVInput],
    queryFn: () => suggestPOVs(debouncedPOVInput),
    enabled: debouncedPOVInput.length > 0,
    staleTime: 1000 * 60 * 5,
  })

  const {
    data: posts = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["search", debouncedQuery, searchTags, sort],
    queryFn: () =>
      searchPosts({
        query: debouncedQuery || undefined,
        tags: searchTags.length > 0 ? searchTags : undefined,
        limit: 30,
        sort,
      }),
    enabled: debouncedQuery.length > 0 || searchTags.length > 0,
    staleTime: 1000 * 60,
  })

  useEffect(() => {
    setSearchTags((current) =>
      sameTags(current, initialTags) ? current : initialTags,
    )
  }, [initialTags])

  useEffect(() => {
    onTagsChange?.(searchTags)
  }, [searchTags, onTagsChange])

  const addSearchTag = useCallback(
    (tag: string) => {
      const trimmed = tag.trim()
      if (!trimmed) return
      if (trimmed.length > POV_CONSTRAINTS.MAX_LENGTH) {
        onPOVTooLong()
        return
      }
      setSearchTags((prev) =>
        prev.includes(trimmed) ? prev : [...prev, trimmed],
      )
    },
    [onPOVTooLong],
  )

  const setSearchTagInputValue = (value: string) => {
    const normalized = value.startsWith("#") ? value.slice(1) : value
    setSearchTagInput(normalized.slice(0, POV_CONSTRAINTS.MAX_LENGTH))
  }

  const addSearchTagFromInput = () => {
    addSearchTag(searchTagInput)
    setSearchTagInput("")
  }

  const addPOVSuggestion = (pov: string) => {
    addSearchTag(pov)
    setSearchQuery("")
    setSearchTagInput("")
    setShowPOVSearch(true)
  }

  const addQueryAsPOVIfExact = () => {
    const exact = queryPOVSuggestions.find(
      (pov) => pov.toLowerCase() === normalizedQuery.toLowerCase(),
    )
    if (!exact) return false
    addPOVSuggestion(exact)
    return true
  }

  const removeSearchTag = (tag: string) => {
    setSearchTags((prev) => prev.filter((t) => t !== tag))
  }

  const clearTags = () => setSearchTags([])

  const clearSearch = () => {
    setSearchQuery("")
    setSearchTags([])
    setSearchTagInput("")
  }

  return {
    searchQuery,
    setSearchQuery,
    normalizedQuery,
    searchTags,
    searchTagInput,
    setSearchTagInputValue,
    showPOVSearch,
    setShowPOVSearch,
    sort,
    setSort,
    queryPOVSuggestions,
    inputPOVSuggestions,
    posts,
    isLoading,
    isError,
    hasSearch: normalizedQuery.length > 0 || searchTags.length > 0,
    addSearchTag,
    addSearchTagFromInput,
    addPOVSuggestion,
    addQueryAsPOVIfExact,
    removeSearchTag,
    clearTags,
    clearSearch,
  }
}

export type SearchController = ReturnType<typeof useSearchController>
