import { Loader2 } from "lucide-react"
import type React from "react"
import type { Post, User } from "../../api/client"
import { useI18n } from "../../i18n"
import { SearchPostCard } from "../SearchPostCard"

interface POVRelatedPostsProps {
  posts: Post[]
  isLoading: boolean
  user: User | null
  onUserClick?: (userId: string) => void
  onTagClick?: (tag: string) => void
}

export const POVRelatedPosts: React.FC<POVRelatedPostsProps> = ({
  posts,
  isLoading,
  user,
  onUserClick,
  onTagClick,
}) => {
  const { t } = useI18n()

  return (
    <section className="bg-[#1f1f35] border border-cyan-500/15 rounded overflow-hidden">
      <div className="px-3 py-2 border-b border-cyan-500/15 text-sm text-cyan-200 font-mono">
        {t("pov.postsWithPov")}
      </div>
      {isLoading ? (
        <div className="flex justify-center p-8 text-cyan-300">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="py-8 text-center text-sm text-cyan-300/60 font-mono">
          {t("pov.noPosts")}
        </div>
      ) : (
        posts.map((post) => (
          <SearchPostCard
            key={post.id}
            post={post}
            currentUser={user}
            onUserClick={onUserClick}
            onTagClick={onTagClick}
          />
        ))
      )}
    </section>
  )
}
