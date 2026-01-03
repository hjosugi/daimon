import React from "react"
import { Trash2 } from "lucide-react"
import type { Post, User } from "../../api/client"

interface PostHeaderProps {
  post: Post
  currentUser?: User | null
  onDelete?: () => void
  onMatchDetailsClick?: () => void
}

export const PostHeader: React.FC<PostHeaderProps> = ({
  post,
  currentUser,
  onDelete,
  onMatchDetailsClick,
}) => {
  const isOwnPost = currentUser && post.user_id === currentUser.id

  return (
    <div className="p-3 sm:p-4 border-b border-slate-100 bg-gradient-to-r from-blue-50/40 via-purple-50/30 to-blue-50/40">
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-blue-400 via-purple-400 to-blue-500 flex items-center justify-center text-white font-bold text-sm sm:text-base shadow-md flex-shrink-0">
          {post.username ? post.username.slice(0, 1).toUpperCase() : post.id.slice(0, 1).toUpperCase()}
        </div>
        
        {/* User info */}
        <div className="flex-1 min-w-0">
          <div className="text-sm sm:text-base font-semibold text-slate-800 truncate">
            {post.username || `User_${post.user_id?.slice(0, 8) || post.id.slice(0, 8)}`}
          </div>
          {post.created_at && (
            <div className="text-xs text-slate-500">
              {new Date(post.created_at).toLocaleString()}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {isOwnPost && (
            <button
              onClick={onDelete}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all active:scale-95"
              title="Delete post"
            >
              <Trash2 size={18} />
            </button>
          )}
          {!isOwnPost && (
            <div className="flex items-center gap-2">
              {post.match_reason?.pov_match_rate !== undefined && (
                <button
                  onClick={onMatchDetailsClick}
                  disabled={post.match_reason.pov_match_rate === 0}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-semibold shadow-sm whitespace-nowrap transition-all ${
                    post.match_reason.pov_match_rate === 0
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 hover:from-purple-200 hover:to-pink-200 cursor-pointer active:scale-95"
                  }`}
                  title={
                    post.match_reason.pov_match_rate === 0
                      ? "No match"
                      : "Click to see your posts that contributed to this match"
                  }
                >
                  {Math.round(post.match_reason.pov_match_rate * 100)}% Match
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
