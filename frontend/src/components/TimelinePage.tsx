import { useQuery } from "@tanstack/react-query"
import { MessageCircle, Pencil } from "lucide-react"
import { useState } from "react"
import type { User } from "../api/client"
import { getTimeline } from "../api/client"
import { useI18n } from "../i18n"
import { PostCard } from "./PostCard"
import { PostInputForm } from "./PostInputForm"
import { QueryStateView } from "./ui/QueryStateView"

interface TimelinePageProps {
  user: User | null
  queryText: string
  similarityWeight: number
  boostPopular: boolean
  includeFarPosts: boolean
  onAuthRequired: () => void
  onTagClick: (tag: string) => void
  onUserClick?: (userId: string) => void
}

export const TimelinePage: React.FC<TimelinePageProps> = ({
  user,
  queryText,
  similarityWeight,
  boostPopular,
  includeFarPosts,
  onAuthRequired,
  onTagClick,
  onUserClick,
}) => {
  const { t } = useI18n()
  const [showPostForm, setShowPostForm] = useState(false)
  const openComposer = () => {
    if (!user) {
      onAuthRequired()
      return
    }
    setShowPostForm(true)
  }
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
      {showPostForm && (
        <PostInputForm
          user={user}
          onAuthRequired={onAuthRequired}
          onPostCreated={() => setShowPostForm(false)}
        />
      )}

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
                className="empty-state-action"
                onClick={openComposer}
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

      <button
        type="button"
        onClick={() => {
          if (!user) {
            onAuthRequired()
            return
          }
          setShowPostForm(!showPostForm)
        }}
        className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-r from-cyan-500/90 to-fuchsia-500/90 text-black rounded-full hover:from-cyan-400 hover:to-fuchsia-400 transition-all flex items-center justify-center z-40 font-mono font-bold"
        title={t("timeline.createPost")}
        aria-label={t("timeline.createPost")}
      >
        <Pencil size={24} className="sm:w-6 sm:h-6" />
      </button>
    </main>
  )
}
