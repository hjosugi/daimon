import { Bookmark, Heart, MessageSquare } from "lucide-react"
import type React from "react"
import type { Post, User } from "../../api/client"
import { useI18n } from "../../i18n"
import { CommentsPanel } from "./CommentsPanel"
import type { PostCardActions } from "./usePostCardActions"

interface PostActionsProps {
  post: Post
  currentUser?: User | null
  actions: PostCardActions
}

export const PostActions: React.FC<PostActionsProps> = ({
  post,
  currentUser,
  actions,
}) => {
  const { t } = useI18n()

  return (
    <div className="px-4 sm:px-5 py-3 sm:py-4 border-t border-cyan-500/15 bg-[#2a2a50]">
      <div className="flex items-center gap-4 sm:gap-8">
        <button
          type="button"
          onClick={actions.toggleLike}
          disabled={actions.likePending}
          className={`flex items-center gap-1.5 sm:gap-2 transition-all group px-2 sm:px-3 py-1 sm:py-1.5 rounded font-mono border ${
            post.liked
              ? "text-red-300 bg-red-900/15 border-red-500/25"
              : "text-cyan-300/90 hover:text-red-300 hover:bg-red-900/10 border-transparent hover:border-red-500/20"
          } ${actions.likePending ? "opacity-50 cursor-wait" : ""}`}
        >
          <Heart
            size={18}
            className={`sm:w-5 sm:h-5 transition-all ${
              post.liked
                ? "fill-red-300 stroke-red-300"
                : "group-hover:fill-red-300 group-hover:stroke-red-300"
            } ${actions.likePending ? "animate-pulse" : ""}`}
          />
          <span className="text-xs sm:text-sm font-semibold">
            {actions.likePending ? "..." : (post.likes ?? 0)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => actions.setShowComments(!actions.showComments)}
          className={`flex items-center gap-1.5 sm:gap-2 transition-all group px-2 sm:px-3 py-1 sm:py-1.5 rounded font-mono border ${
            actions.showComments
              ? "text-cyan-300 bg-cyan-900/15 border-cyan-500/15"
              : "text-cyan-300/90 hover:text-cyan-300 hover:bg-cyan-900/10 border-transparent hover:border-cyan-500/12"
          }`}
        >
          <MessageSquare
            size={18}
            className={`sm:w-5 sm:h-5 transition-colors ${
              actions.showComments
                ? "stroke-cyan-300"
                : "group-hover:stroke-cyan-300"
            }`}
          />
          <span className="text-xs sm:text-sm font-semibold">
            {post.commentCount ?? actions.comments.length ?? 0}
          </span>
        </button>

        {currentUser && (
          <button
            type="button"
            onClick={actions.toggleSave}
            className={`flex items-center gap-1.5 sm:gap-2 transition-all group px-2 sm:px-3 py-1 sm:py-1.5 rounded font-mono border active:scale-95 ml-auto ${
              actions.saved
                ? "text-amber-300 bg-amber-900/15 border-amber-500/25"
                : "text-cyan-300/90 hover:text-amber-300 hover:bg-amber-900/10 border-transparent hover:border-amber-500/20"
            }`}
            title={actions.saved ? t("post.savedTitle") : t("post.saveTitle")}
          >
            <Bookmark
              size={18}
              className={`sm:w-5 sm:h-5 ${
                actions.saved ? "fill-amber-300" : ""
              }`}
            />
            <span className="text-xs sm:text-sm font-semibold hidden sm:inline">
              {actions.saved ? t("post.saved") : t("post.save")}
            </span>
          </button>
        )}
      </div>

      {actions.showComments && (
        <CommentsPanel
          comments={actions.comments}
          commentText={actions.commentText}
          isAdding={actions.addCommentPending}
          onCommentTextChange={actions.setCommentText}
          onAddComment={actions.addCurrentComment}
        />
      )}
    </div>
  )
}
