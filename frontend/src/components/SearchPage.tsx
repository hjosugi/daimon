import { useQuery } from "@tanstack/react-query"
import { Loader2, Search, X, Tag as TagIcon, ArrowLeft } from "lucide-react"
import { useState, useEffect } from "react"
import { searchPosts, getCurrentUser, type User } from "../api/client"
import { PostCard } from "./PostCard"
import type React from "react"

interface SearchPageProps {
  initialTags?: string[]
  onTagsChange?: (tags: string[]) => void
  onBack?: () => void
}

export const SearchPage: React.FC<SearchPageProps> = ({ initialTags = [], onTagsChange, onBack }) => {
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [searchTags, setSearchTags] = useState<string[]>(initialTags)
  const [searchTagInput, setSearchTagInput] = useState<string>("")
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  // Get current user
  useEffect(() => {
    const token = localStorage.getItem("auth_token")
    if (token) {
      getCurrentUser()
        .then(setCurrentUser)
        .catch(() => setCurrentUser(null))
    }
  }, [])

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
    queryKey: ["search", searchQuery, searchTags],
    queryFn: () =>
      searchPosts({
        query: searchQuery || undefined,
        tags: searchTags.length > 0 ? searchTags : undefined,
      }),
    enabled: searchQuery.trim().length > 0 || searchTags.length > 0,
    staleTime: 1000 * 60 * 1,
  })

  const handleSearchTagAdd = () => {
    // Allow spaces in POV names, only trim leading/trailing spaces
    const trimmed = searchTagInput.trim()
    if (!trimmed || searchTags.includes(trimmed)) return
    // Validate POV length (max 300 characters)
    if (trimmed.length > 300) {
      alert("POV must be 300 characters or less")
      return
    }
    setSearchTags((prev) => [...prev, trimmed])
    setSearchTagInput("")
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Back Button */}
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors mb-4"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-medium">Back to Timeline</span>
          </button>
        )}
        {/* Search Bar */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-md border border-slate-200/50 overflow-hidden sticky top-2 sm:top-4 z-10">
          <div className="p-3 sm:p-4 border-b border-slate-100 bg-gradient-to-r from-blue-50/50 to-purple-50/50">
            <div className="flex items-center gap-2">
              <Search size={18} className="sm:w-5 sm:h-5 text-blue-600" />
              <h2 className="text-base sm:text-lg font-semibold text-slate-700">Search</h2>
              {(searchQuery.trim() || searchTags.length > 0) && (
                <button
                  onClick={clearSearch}
                  className="ml-auto text-xs sm:text-sm text-slate-500 hover:text-slate-700 px-2 sm:px-3 py-1 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1"
                >
                  <X size={14} className="sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Clear</span>
                </button>
              )}
            </div>
          </div>
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
            {/* Search Query Input */}
            <div className="relative">
              <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  // Enter to search
                  if (e.key === "Enter") {
                    e.preventDefault()
                    // The query will be automatically executed by useQuery when searchQuery changes
                  }
                }}
                placeholder="Search posts... (Press Enter to search)"
                className="w-full pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3 bg-slate-50 rounded-lg sm:rounded-xl border-2 border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-slate-700 placeholder:text-slate-400 text-sm sm:text-base"
                autoFocus
              />
            </div>

            {/* POV Search */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-2 sm:mb-3">
                Search by POVs
              </label>
              <div className="flex gap-2 items-center">
                <TagIcon className="text-slate-400 flex-shrink-0" size={16} />
                <input
                  type="text"
                  value={searchTagInput}
                  maxLength={300}
                  onChange={(e) => {
                    let value = e.target.value
                    if (value.startsWith("#")) {
                      value = value.slice(1)
                    }
                    // Limit to 300 characters
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
                  placeholder="Enter POV and press Enter (max 300 chars)"
                  className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-50 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-200 focus:border-blue-300 text-slate-700 placeholder:text-slate-400 text-sm"
                />
                <button
                  type="button"
                  onClick={handleSearchTagAdd}
                  disabled={!searchTagInput.trim()}
                  className="px-4 sm:px-5 py-2 sm:py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs sm:text-sm font-medium"
                >
                  Add
                </button>
              </div>
              {searchTags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 sm:mt-3">
                  {searchTags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => handleSearchTagRemove(tag)}
                        className="hover:bg-blue-100 rounded-full p-0.5 transition-colors"
                      >
                        <X size={12} className="sm:w-3.5 sm:h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search Results */}
        <div className="space-y-4">
          {searchQuery.trim() || searchTags.length > 0 ? (
            <>
              {(searchQuery.trim() || searchTags.length > 0) && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-sm text-blue-700">
                    <Search size={16} />
                    <span className="font-medium">
                      {searchQuery.trim() && `"${searchQuery}"`}
                      {searchTags.length > 0 && ` #${searchTags.join(" #")}`}
                      {searchQuery.trim() || searchTags.length > 0 ? " search results" : ""}
                    </span>
                  </div>
                </div>
              )}
              {isLoading ? (
                <div className="flex justify-center p-12 text-slate-400">
                  <Loader2 size={32} className="animate-spin" />
                </div>
              ) : isError ? (
                <div className="text-center py-12 text-red-400">
                  <p>Failed to load. Please try again.</p>
                </div>
              ) : (
                        <>
                          {posts.map((post) => (
                            <PostCard 
                              key={post.id} 
                              post={post}
                              currentUser={currentUser}
                              onTagClick={(tag) => {
                                if (!searchTags.includes(tag)) {
                                  setSearchTags((prev) => [...prev, tag])
                                }
                              }}
                            />
                          ))}
                  {posts.length === 0 && (
                    <div className="text-center py-16 text-slate-400">
                      <Search size={48} className="mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">No results found</p>
                      <p className="text-sm mt-2">Try searching with different keywords or tags</p>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="text-center py-16 text-slate-400">
              <Search size={64} className="mx-auto mb-6 opacity-30" />
              <p className="text-xl font-medium text-slate-500">Start Searching</p>
              <p className="text-sm mt-2 text-slate-400">
                Search posts by keywords or POVs
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
