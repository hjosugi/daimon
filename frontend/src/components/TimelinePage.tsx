import { useInfiniteQuery } from "@tanstack/react-query"
import { Loader2, MessageCircle, Pencil } from "lucide-react"
import { useEffect, useMemo, useRef } from "react"
import type { User } from "../api/client"
import { getTimeline } from "../api/client"
import { useI18n } from "../i18n"
import { PostCard } from "./PostCard"
import { QueryStateView } from "./ui/QueryStateView"

const TIMELINE_PAGE_SIZE = 20

interface TimelinePageProps {
  user: User | null
  queryText: string
  similarityWeight: number
  boostPopular: boolean
  includeFarPosts: boolean
  onCompose: () => void
  onTagClick: (tag: string) => void
  onUserClick?: (userId: string) => void
}

export const TimelinePage: React.FC<TimelinePageProps> = ({
  user,
  queryText,
  similarityWeight,
  boostPopular,
  includeFarPosts,
  onCompose,
  onTagClick,
  onUserClick,
}) => {
  const { t } = useI18n()
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const {
    data,
    isLoading,
    isError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: [
      "timeline",
      user?.id,
      similarityWeight,
      queryText,
      boostPopular,
      includeFarPosts,
    ],
    queryFn: ({ pageParam }) =>
      getTimeline(
        queryText || "General interest",
        similarityWeight,
        boostPopular,
        includeFarPosts,
        TIMELINE_PAGE_SIZE,
        pageParam,
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === TIMELINE_PAGE_SIZE
        ? pages.length * TIMELINE_PAGE_SIZE
        : undefined,
    staleTime: 1000 * 60 * 5,
  })

  const posts = useMemo(() => {
    const seen = new Set<string>()
    return (data?.pages ?? []).flatMap((page) =>
      page.filter((post) => {
        if (seen.has(post.id)) return false
        seen.add(post.id)
        return true
      }),
    )
  }, [data])

  useEffect(() => {
    const target = loadMoreRef.current
    if (!target || !hasNextPage) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) {
          void fetchNextPage()
        }
      },
      { rootMargin: "600px 0px" },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  return (
    <main className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 relative">
      <div className="space-y-4">
        <QueryStateView
          isLoading={isLoading}
          isError={isError}
          isEmpty={posts.length === 0}
          loadingClassName="flex justify-center p-8 text-cyan-300/90"
          errorClassName="text-center py-12 text-red-400/70"
          emptyClassName="empty-state"
          error={<p className="font-mono">{t("timeline.loadError")}</p>}
          empty={
            <>
              <span className="empty-state-icon" aria-hidden="true">
                <MessageCircle size={28} />
              </span>
              <h2>{t("timeline.noPosts")}</h2>
              <p>{t("timeline.emptyHint")}</p>
              <button
                type="button"
                className="empty-state-action compose-action transition-all"
                onClick={onCompose}
              >
                <Pencil size={16} />
                {t("timeline.createPost")}
              </button>
            </>
          }
        >
          {posts.map((post) => (
            <div key={post.id} className="feed-item-enter">
              <PostCard
                post={post}
                onTagClick={onTagClick}
                onUserClick={onUserClick}
                currentUser={user}
              />
            </div>
          ))}
          <div
            ref={loadMoreRef}
            className="timeline-load-more"
            aria-live="polite"
          >
            {isFetchingNextPage && (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>{t("timeline.loadingMore")}</span>
              </>
            )}
            {!hasNextPage && posts.length > 0 && (
              <span>{t("timeline.caughtUp")}</span>
            )}
          </div>
        </QueryStateView>
      </div>
    </main>
  )
}
