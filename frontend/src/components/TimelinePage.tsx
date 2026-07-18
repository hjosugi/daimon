import { useQuery } from "@tanstack/react-query"
import { MessageCircle, Pencil } from "lucide-react"
import type { User } from "../api/client"
import { getTimeline } from "../api/client"
import { useI18n } from "../i18n"
import { PostCard } from "./PostCard"
import { QueryStateView } from "./ui/QueryStateView"

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
  const {
    data: posts = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: [
      "timeline",
      similarityWeight,
      queryText,
      boostPopular,
      includeFarPosts,
    ],
    queryFn: () =>
      getTimeline(
        queryText || "General interest",
        similarityWeight,
        boostPopular,
        includeFarPosts,
      ),
    staleTime: 1000 * 60 * 5,
  })

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
            <PostCard
              key={post.id}
              post={post}
              onTagClick={onTagClick}
              onUserClick={onUserClick}
              currentUser={user}
            />
          ))}
        </QueryStateView>
      </div>
    </main>
  )
}
