import { ArrowLeft } from "lucide-react"
import type React from "react"
import { useMemo } from "react"
import type { POVCommentStance, User } from "../api/client"
import { useI18n } from "../i18n"
import { POVCommentComposer } from "./POVDiscussionPage/POVCommentComposer"
import { POVCommentList } from "./POVDiscussionPage/POVCommentList"
import { POVHero } from "./POVDiscussionPage/POVHero"
import { POVRelatedPosts } from "./POVDiscussionPage/POVRelatedPosts"
import { usePOVDiscussion } from "./POVDiscussionPage/usePOVDiscussion"

interface POVDiscussionPageProps {
  pov: string
  user: User | null
  onBack: () => void
  onAuthRequired: () => void
  onUserClick?: (userId: string) => void
  onTagClick?: (tag: string) => void
}

export const POVDiscussionPage: React.FC<POVDiscussionPageProps> = ({
  pov,
  user,
  onBack,
  onAuthRequired,
  onUserClick,
  onTagClick,
}) => {
  const { t } = useI18n()
  const discussion = usePOVDiscussion({ pov, user, onAuthRequired })
  const stanceLabels = useMemo<Record<POVCommentStance, string>>(
    () => ({
      support: t("pov.stance.support"),
      question: t("pov.stance.question"),
      oppose: t("pov.stance.oppose"),
      note: t("pov.stance.note"),
    }),
    [t],
  )

  return (
    <main className="min-h-screen bg-[#151520]">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-4 space-y-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-cyan-300/80 hover:text-cyan-200 font-mono transition-colors"
        >
          <ArrowLeft size={16} />
          {t("pov.back")}
        </button>

        <POVHero
          pov={pov}
          postsCount={discussion.posts.length}
          commentsCount={discussion.comments.length}
          stanceCounts={discussion.stanceCounts}
          stanceLabels={stanceLabels}
          stood={discussion.stood}
          standCount={discussion.standCount}
          onToggleStand={discussion.toggleStand}
        />

        <section className="bg-[#1f1f35] border border-cyan-500/15 rounded p-3">
          <POVCommentComposer
            user={user}
            text={discussion.text}
            stance={discussion.stance}
            stanceLabels={stanceLabels}
            isPending={discussion.addPending}
            onTextChange={discussion.setText}
            onStanceChange={discussion.setStance}
            onSubmit={discussion.submitComment}
          />
          <POVCommentList
            comments={discussion.comments}
            isLoading={discussion.commentsLoading}
            isDeleting={discussion.deletePending}
            stanceLabels={stanceLabels}
            onUserClick={onUserClick}
            onDelete={discussion.deleteComment}
          />
        </section>

        <POVRelatedPosts
          posts={discussion.posts}
          isLoading={discussion.postsLoading}
          user={user}
          onUserClick={onUserClick}
          onTagClick={onTagClick}
        />
      </div>
    </main>
  )
}
