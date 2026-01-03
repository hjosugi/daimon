import React from "react"
import { MessageSquare, Heart } from "lucide-react"
import type { Post } from "../../api/client"

interface PostActionsProps {
  post: Post
  liked: boolean
  onLike: () => void
  onCommentClick: () => void
  isLiking?: boolean
}

export const PostActions: React.FC<PostActionsProps> = ({
  post,
  liked,
  onLike,
  onCommentClick,
  isLiking = false,
}) => {
  return (
    <div className="px-4 sm:px-5 py-3 sm:py-4 border-t border-slate-100 bg-gradient-to-r from-slate-50 via-blue-50/30 to-purple-50/20">
      <div className="flex items-center gap-4 sm:gap-6">
        <button
          onClick={onLike}
          disabled={isLiking}
          className={`flex items-center gap-2 transition-all active:scale-95 ${
            liked
              ? "text-red-500 hover:text-red-600"
              : "text-slate-400 hover:text-red-500"
          }`}
        >
          <Heart size={20} className={liked ? "fill-current" : ""} />
          <span className="text-sm font-medium">{post.likes || 0}</span>
        </button>

        <button
          onClick={onCommentClick}
          className="flex items-center gap-2 text-slate-400 hover:text-blue-500 transition-all active:scale-95"
        >
          <MessageSquare size={20} />
          <span className="text-sm font-medium">{post.commentCount || 0}</span>
        </button>
      </div>
    </div>
  )
}
