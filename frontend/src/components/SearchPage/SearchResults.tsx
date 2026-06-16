import { Loader2, Search } from "lucide-react"
import type React from "react"
import type { User } from "../../api/client"
import { useI18n } from "../../i18n"
import { SearchPostCard } from "../SearchPostCard"
import type { SearchController } from "./useSearchController"

interface SearchResultsProps {
  search: SearchController
  currentUser?: User | null
  onUserClick?: (userId: string) => void
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  search,
  currentUser,
  onUserClick,
}) => {
  const { t } = useI18n()

  if (!search.hasSearch) {
    return (
      <div className="text-center py-16 text-cyan-300/70">
        <Search size={64} className="mx-auto mb-6 opacity-20" />
        <p className="text-xl font-medium text-cyan-300 font-mono">
          {t("search.start")}
        </p>
        <p className="text-sm mt-2 text-cyan-300/80 font-mono">
          {t("search.description")}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="bg-[#1f1f35] border border-cyan-500/15 rounded p-2">
        <div className="flex items-center gap-1.5 text-xs font-mono text-cyan-300">
          <Search size={12} />
          <span>
            {search.searchQuery.trim() && `"${search.searchQuery}"`}
            {search.searchTags.length > 0 &&
              ` #${search.searchTags.join(" #")}`}
            {search.posts.length > 0 &&
              ` → ${t("search.results", { count: search.posts.length })}`}
          </span>
        </div>
      </div>

      {search.isLoading ? (
        <div className="flex justify-center p-12 text-cyan-300">
          <Loader2 size={32} className="animate-spin" />
        </div>
      ) : search.isError ? (
        <div className="text-center py-12 text-red-300">
          <p className="font-mono">{t("search.loadError")}</p>
        </div>
      ) : search.posts.length > 0 ? (
        <div className="bg-[#1f1f35] rounded border border-cyan-500/15 overflow-hidden">
          {search.posts.map((post) => (
            <SearchPostCard
              key={post.id}
              post={post}
              currentUser={currentUser}
              onUserClick={onUserClick}
              onTagClick={search.addSearchTag}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-cyan-300/80">
          <div className="font-mono text-xs text-cyan-300/70 mb-2">
            {t("search.noResults")}
          </div>
          <p className="text-sm text-cyan-300 font-mono">
            {t("search.tryDifferent")}
          </p>
        </div>
      )}
    </div>
  )
}
