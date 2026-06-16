import { useQuery } from "@tanstack/react-query"
import { ChevronDown, ChevronUp, Hash, Loader2, Search, X } from "lucide-react"
import type React from "react"
import { useCallback, useEffect, useState } from "react"
import { searchPosts, suggestPOVs, type User } from "../api/client"
import { useDebouncedValue } from "../hooks/useDebouncedValue"
import { SearchPostCard } from "./SearchPostCard"

interface SearchPageProps {
  initialTags?: string[]
  onTagsChange?: (tags: string[]) => void
  onBack?: () => void
  onUserClick?: (userId: string) => void
  currentUser?: User | null
}

export const SearchPage: React.FC<SearchPageProps> = ({
  initialTags = [],
  onTagsChange,
  onUserClick,
  currentUser = null,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [searchTags, setSearchTags] = useState<string[]>(initialTags)
  const [searchTagInput, setSearchTagInput] = useState<string>("")
  const [showPOVSearch, setShowPOVSearch] = useState<boolean>(false)

  const normalizedQuery = searchQuery.trim()
  const debouncedQuery = useDebouncedValue(searchQuery, 250).trim()
  const debouncedPOVInput = useDebouncedValue(searchTagInput, 200).trim()

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

  // Update search tags when initialTags change
  useEffect(() => {
    if (initialTags.length > 0) {
      setSearchTags(initialTags)
    }
  }, [initialTags])

  // Notify parent when tags change
  useEffect(() => {
    onTagsChange?.(searchTags)
  }, [searchTags, onTagsChange])

  const {
    data: posts = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["search", debouncedQuery, searchTags],
    queryFn: () =>
      searchPosts({
        query: debouncedQuery || undefined,
        tags: searchTags.length > 0 ? searchTags : undefined,
      }),
    enabled: debouncedQuery.length > 0 || searchTags.length > 0,
    staleTime: 1000 * 60 * 1,
  })

  const addSearchTag = useCallback((tag: string) => {
    const trimmed = tag.trim()
    if (!trimmed) return
    if (trimmed.length > 300) {
      alert("POV must be 300 characters or less")
      return
    }
    setSearchTags((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]))
  }, [])

  const handleResultTagClick = useCallback(
    (tag: string) => addSearchTag(tag),
    [addSearchTag],
  )

  const handleSearchTagAdd = () => {
    addSearchTag(searchTagInput)
    setSearchTagInput("")
  }

  const addQueryAsPOVIfExact = () => {
    const exact = queryPOVSuggestions.find(
      (pov) => pov.toLowerCase() === normalizedQuery.toLowerCase(),
    )
    if (!exact) return false
    addSearchTag(exact)
    setSearchQuery("")
    setShowPOVSearch(true)
    return true
  }

  const handleSearchTagRemove = (tag: string) => {
    setSearchTags((prev) => prev.filter((t) => t !== tag))
  }

  const clearSearch = () => {
    setSearchQuery("")
    setSearchTags([])
    setSearchTagInput("")
  }

  return (
    <div className="min-h-screen bg-[#151520]">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-4 space-y-2">
        {/* Simple Search Input - Cyberpunk style */}
        <div className="bg-[#1f1f35] rounded border border-cyan-500/15">
          <div className="p-3 space-y-2">
            {/* Text Search */}
            <div className="relative">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cyan-300/80"
                size={16}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addQueryAsPOVIfExact()
                  }
                }}
                placeholder="SEARCH POSTS..."
                className="w-full pl-9 pr-3 py-2 bg-[#2a2a50] rounded border border-cyan-500/15 focus:border-cyan-500/35 focus:ring-1 focus:ring-cyan-500/20 text-cyan-200 placeholder:text-cyan-300/70 text-sm font-mono transition-all"
              />
              {(searchQuery.trim() || searchTags.length > 0) && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-cyan-300/80 hover:text-red-300 p-1 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {normalizedQuery && queryPOVSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[11px] text-cyan-300/70 font-mono self-center">
                  既存POV:
                </span>
                {queryPOVSuggestions.slice(0, 6).map((pov) => (
                  <button
                    key={pov}
                    type="button"
                    onClick={() => {
                      addSearchTag(pov)
                      setSearchQuery("")
                      setShowPOVSearch(true)
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono text-fuchsia-200 bg-fuchsia-900/20 border border-fuchsia-500/25 rounded hover:border-fuchsia-500/50 hover:bg-fuchsia-900/30 transition-colors"
                  >
                    <Hash size={10} />
                    {pov}
                  </button>
                ))}
              </div>
            )}

            {/* POV Search Toggle */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPOVSearch(!showPOVSearch)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-mono text-fuchsia-100 hover:bg-fuchsia-900/20 border border-fuchsia-500/30 hover:border-fuchsia-500/50 rounded transition-colors"
              >
                <Hash size={14} />
                <span>POVで絞り込み</span>
                {searchTags.length > 0 && (
                  <span className="ml-0.5 min-w-[18px] px-1.5 rounded-full bg-fuchsia-500 text-black text-[11px] font-bold text-center">
                    {searchTags.length}
                  </span>
                )}
                {showPOVSearch ? (
                  <ChevronUp size={14} />
                ) : (
                  <ChevronDown size={14} />
                )}
              </button>
            </div>

            {/* Selected POVs — prominent so it's clear what's filtering */}
            {searchTags.length > 0 && (
              <div className="rounded border border-fuchsia-500/30 bg-fuchsia-900/15 p-2.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-fuchsia-100 font-mono">
                    絞り込み中の POV（{searchTags.length}）
                  </span>
                  <button
                    type="button"
                    onClick={() => setSearchTags([])}
                    className="flex items-center gap-1 text-xs text-fuchsia-200 hover:text-red-300 transition-colors"
                  >
                    <X size={12} />
                    すべて消す
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {searchTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 bg-fuchsia-500 text-black rounded-full text-xs font-mono font-semibold"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => handleSearchTagRemove(tag)}
                        aria-label={`「${tag}」を外す`}
                        title={`「${tag}」を外す`}
                        className="rounded-full hover:bg-black/25 p-0.5 transition-colors"
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* POV Input (collapsible) */}
            {showPOVSearch && (
              <div className="pt-1 border-t border-fuchsia-500/12">
                <div className="flex gap-1.5 items-center">
                  <Hash className="text-fuchsia-300 flex-shrink-0" size={12} />
                  <input
                    type="text"
                    value={searchTagInput}
                    maxLength={300}
                    onChange={(e) => {
                      let value = e.target.value
                      if (value.startsWith("#")) {
                        value = value.slice(1)
                      }
                      if (value.length > 300) {
                        value = value.slice(0, 300)
                      }
                      setSearchTagInput(value)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleSearchTagAdd()
                      }
                    }}
                    placeholder="ENTER POV (ENTER TO ADD)"
                    className="flex-1 px-2 py-1.5 bg-[#2a2a50] rounded border border-fuchsia-500/25 focus:ring-1 focus:ring-fuchsia-500/30 focus:border-fuchsia-500/40 text-fuchsia-300 placeholder:text-fuchsia-400/60 text-xs font-mono transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleSearchTagAdd}
                    disabled={!searchTagInput.trim()}
                    className="px-2 py-1.5 bg-fuchsia-500/90 text-black rounded hover:bg-fuchsia-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs font-mono font-bold"
                  >
                    +
                  </button>
                </div>
                {inputPOVSuggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 pl-5">
                    {inputPOVSuggestions.slice(0, 8).map((pov) => (
                      <button
                        key={pov}
                        type="button"
                        onClick={() => {
                          addSearchTag(pov)
                          setSearchTagInput("")
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono text-fuchsia-200 bg-fuchsia-900/20 border border-fuchsia-500/25 rounded hover:border-fuchsia-500/50 hover:bg-fuchsia-900/30 transition-colors"
                      >
                        <Hash size={10} />
                        {pov}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Search Results */}
        <div className="space-y-2">
          {searchQuery.trim() || searchTags.length > 0 ? (
            <>
              {(searchQuery.trim() || searchTags.length > 0) && (
                <div className="bg-[#1f1f35] border border-cyan-500/15 rounded p-2">
                  <div className="flex items-center gap-1.5 text-xs font-mono text-cyan-300">
                    <Search size={12} />
                    <span>
                      {searchQuery.trim() && `"${searchQuery}"`}
                      {searchTags.length > 0 && ` #${searchTags.join(" #")}`}
                      {posts.length > 0 && ` → ${posts.length} RESULTS`}
                    </span>
                  </div>
                </div>
              )}
              {isLoading ? (
                <div className="flex justify-center p-12 text-cyan-300">
                  <Loader2 size={32} className="animate-spin" />
                </div>
              ) : isError ? (
                <div className="text-center py-12 text-red-300">
                  <p className="font-mono">[ERROR] FAILED TO LOAD</p>
                </div>
              ) : posts.length > 0 ? (
                <div className="bg-[#1f1f35] rounded border border-cyan-500/15 overflow-hidden">
                  {posts.map((post) => (
                    <SearchPostCard
                      key={post.id}
                      post={post}
                      currentUser={currentUser}
                      onUserClick={onUserClick}
                      onTagClick={handleResultTagClick}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-cyan-300/80">
                  <div className="font-mono text-xs text-cyan-300/70 mb-2">
                    [NO RESULTS]
                  </div>
                  <p className="text-sm text-cyan-300 font-mono">
                    TRY DIFFERENT KEYWORDS OR TAGS
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16 text-cyan-300/70">
              <Search size={64} className="mx-auto mb-6 opacity-20" />
              <p className="text-xl font-medium text-cyan-300 font-mono">
                START SEARCHING
              </p>
              <p className="text-sm mt-2 text-cyan-300/80 font-mono">
                SEARCH POSTS BY KEYWORDS OR POVS
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
