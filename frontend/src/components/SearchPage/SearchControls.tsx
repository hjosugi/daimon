import { ChevronDown, ChevronUp, Hash, Search, X } from "lucide-react"
import type React from "react"
import { useI18n } from "../../i18n"
import { POV_CONSTRAINTS } from "../../types/constants"
import type { SearchController } from "./useSearchController"

interface SearchControlsProps {
  search: SearchController
}

export const SearchControls: React.FC<SearchControlsProps> = ({ search }) => {
  const { t } = useI18n()

  return (
    <div className="bg-[#1f1f35] rounded border border-cyan-500/15">
      <div className="p-3 space-y-2">
        <div className="relative">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cyan-300/80"
            size={16}
          />
          <input
            type="text"
            value={search.searchQuery}
            onChange={(e) => search.setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                search.addQueryAsPOVIfExact()
              }
            }}
            placeholder={t("search.placeholder")}
            className="search-primary-input w-full pl-9 pr-9 py-2 bg-[#2a2a50] rounded border border-cyan-500/15 focus:border-cyan-500/35 focus:ring-1 focus:ring-cyan-500/20 text-sm font-mono transition-all"
          />
          {search.hasSearch && (
            <button
              type="button"
              onClick={search.clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-cyan-300/80 hover:text-red-300 p-1 transition-colors"
              title={t("search.clearAll")}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {search.normalizedQuery && search.queryPOVSuggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[11px] text-cyan-300/70 font-mono self-center">
              {t("search.existingPov")}
            </span>
            {search.queryPOVSuggestions.slice(0, 6).map((pov) => (
              <button
                key={pov}
                type="button"
                onClick={() => search.addPOVSuggestion(pov)}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono text-fuchsia-200 bg-fuchsia-900/20 border border-fuchsia-500/25 rounded hover:border-fuchsia-500/50 hover:bg-fuchsia-900/30 transition-colors"
              >
                <Hash size={10} />
                {pov}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => search.setShowPOVSearch(!search.showPOVSearch)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-mono text-fuchsia-100 hover:bg-fuchsia-900/20 border border-fuchsia-500/30 hover:border-fuchsia-500/50 rounded transition-colors"
          >
            <Hash size={14} />
            <span>{t("search.filterByPov")}</span>
            {search.searchTags.length > 0 && (
              <span className="ml-0.5 min-w-[18px] px-1.5 rounded-full bg-fuchsia-500 text-black text-[11px] font-bold text-center">
                {search.searchTags.length}
              </span>
            )}
            {search.showPOVSearch ? (
              <ChevronUp size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
          </button>
          <label className="search-sort-control">
            <span>{t("search.sortLabel")}</span>
            <select
              value={search.sort}
              onChange={(event) =>
                search.setSort(event.target.value as "relevance" | "newest")
              }
            >
              <option value="relevance">{t("search.sortRelevance")}</option>
              <option value="newest">{t("search.sortNewest")}</option>
            </select>
          </label>
        </div>

        {search.searchTags.length > 0 && (
          <div className="rounded border border-fuchsia-500/30 bg-fuchsia-900/15 p-2.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-fuchsia-100 font-mono">
                {t("search.activePovs", { count: search.searchTags.length })}
              </span>
              <button
                type="button"
                onClick={search.clearTags}
                className="flex items-center gap-1 text-xs text-fuchsia-200 hover:text-red-300 transition-colors"
              >
                <X size={12} />
                {t("search.clearAll")}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {search.searchTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 bg-fuchsia-500 text-black rounded-full text-xs font-mono font-semibold"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => search.removeSearchTag(tag)}
                    aria-label={t("search.removeTag", { tag })}
                    title={t("search.removeTag", { tag })}
                    className="rounded-full hover:bg-black/25 p-0.5 transition-colors"
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {search.showPOVSearch && (
          <div className="pt-1 border-t border-fuchsia-500/12">
            <div className="flex gap-1.5 items-center">
              <Hash className="text-fuchsia-300 flex-shrink-0" size={12} />
              <input
                type="text"
                value={search.searchTagInput}
                maxLength={POV_CONSTRAINTS.MAX_LENGTH}
                onChange={(e) => search.setSearchTagInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    search.addSearchTagFromInput()
                  }
                }}
                placeholder={t("search.povInputPlaceholder")}
                className="search-pov-input flex-1 px-2 py-1.5 bg-[#2a2a50] rounded border border-fuchsia-500/25 focus:ring-1 focus:ring-fuchsia-500/30 focus:border-fuchsia-500/40 text-xs font-mono transition-all"
              />
              <button
                type="button"
                onClick={search.addSearchTagFromInput}
                disabled={!search.searchTagInput.trim()}
                className="px-2 py-1.5 bg-fuchsia-500/90 text-black rounded hover:bg-fuchsia-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs font-mono font-bold"
              >
                +
              </button>
            </div>
            {search.inputPOVSuggestions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5 pl-5">
                {search.inputPOVSuggestions.slice(0, 8).map((pov) => (
                  <button
                    key={pov}
                    type="button"
                    onClick={() => search.addPOVSuggestion(pov)}
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
  )
}
