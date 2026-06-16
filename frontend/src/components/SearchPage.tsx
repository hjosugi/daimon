import type React from "react"
import type { User } from "../api/client"
import { useI18n } from "../i18n"
import { SearchControls } from "./SearchPage/SearchControls"
import { SearchResults } from "./SearchPage/SearchResults"
import { useSearchController } from "./SearchPage/useSearchController"

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
  const { t } = useI18n()
  const search = useSearchController({
    initialTags,
    onTagsChange,
    onPOVTooLong: () => alert(t("postForm.povTooLong")),
  })

  return (
    <div className="min-h-screen bg-[#151520]">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-4 space-y-2">
        <SearchControls search={search} />
        <SearchResults
          search={search}
          currentUser={currentUser}
          onUserClick={onUserClick}
        />
      </div>
    </div>
  )
}
