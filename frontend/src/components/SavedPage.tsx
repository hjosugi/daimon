import { useQuery } from "@tanstack/react-query"
import { Bookmark } from "lucide-react"
import type React from "react"
import { useMemo, useState } from "react"
import { getSavedPosts, type User } from "../api/client"
import { useI18n } from "../i18n"
import { PostCard } from "./PostCard"
import { QueryStateView } from "./ui/QueryStateView"

interface SavedPageProps {
  user: User | null
  onTagClick?: (tag: string) => void
}

export const SavedPage: React.FC<SavedPageProps> = ({ user, onTagClick }) => {
  const { t } = useI18n()
  const [query, setQuery] = useState("")
  const [povQuery, setPovQuery] = useState("")
  const {
    data: posts = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["saved-posts"],
    queryFn: getSavedPosts,
    enabled: !!user,
    staleTime: 1000 * 15,
  })

  const filteredPosts = useMemo(() => {
    const text = query.trim().toLocaleLowerCase()
    const pov = povQuery.trim().replace(/^#/, "").toLocaleLowerCase()
    return posts.filter((post) => {
      const matchesText = !text || post.text.toLocaleLowerCase().includes(text)
      const matchesPov =
        !pov || post.povs?.some((tag) => tag.toLocaleLowerCase().includes(pov))
      return matchesText && matchesPov
    })
  }, [posts, povQuery, query])

  return (
    <div className="min-h-screen bg-[#151520]">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-4 space-y-2">
        <div className="bg-[#1f1f35] border border-cyan-500/15 rounded p-3">
          <div className="flex items-center gap-2 text-cyan-200 font-mono text-sm">
            <Bookmark size={16} className="text-cyan-300" />
            <span>{t("saved.title")}</span>
            {user && (
              <span className="text-cyan-300/70">（{posts.length}）</span>
            )}
          </div>
        </div>

        {!user ? (
          <div className="text-center py-16 text-cyan-300/70 font-mono text-sm">
            {t("saved.loginRequired")}
          </div>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("saved.searchPlaceholder")}
                aria-label={t("saved.searchPlaceholder")}
                className="w-full rounded border border-cyan-500/25 bg-[#151520] px-3 py-2 text-sm text-cyan-100 placeholder:text-cyan-100/55 outline-none focus:border-cyan-300/70"
              />
              <input
                value={povQuery}
                onChange={(e) => setPovQuery(e.target.value)}
                placeholder={t("saved.povPlaceholder")}
                aria-label={t("saved.povPlaceholder")}
                className="w-full rounded border border-cyan-500/25 bg-[#151520] px-3 py-2 text-sm text-cyan-100 placeholder:text-cyan-100/55 outline-none focus:border-cyan-300/70"
              />
            </div>
            <QueryStateView
              isLoading={isLoading}
              isError={isError}
              isEmpty={filteredPosts.length === 0}
              error={t("saved.loadError")}
              empty={posts.length === 0 ? t("saved.empty") : t("saved.noMatch")}
            >
              <div className="space-y-2">
                {filteredPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onTagClick={onTagClick}
                    currentUser={user}
                  />
                ))}
              </div>
            </QueryStateView>
          </>
        )}
      </div>
    </div>
  )
}
