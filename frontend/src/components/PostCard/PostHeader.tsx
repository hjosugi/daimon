import React from "react"
import { Trash2 } from "lucide-react"
import type { Post, User } from "../../api/client"
import { formatRelativeDate } from "../../utils/date"

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
    <div className="p-3 sm:p-4 border-b border-cyan-500/15 bg-[#1f1f35]">
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-cyan-400/90 via-fuchsia-400/90 to-cyan-500/90 flex items-center justify-center text-black font-bold text-sm sm:text-base border border-cyan-500/18 flex-shrink-0 font-mono">
          {post.username ? post.username.slice(0, 1).toUpperCase() : post.id.slice(0, 1).toUpperCase()}
        </div>
        
        {/* User info */}
        <div className="flex-1 min-w-0">
          <div className="text-sm sm:text-base font-semibold text-cyan-300 truncate font-mono">
            {post.username || `USER_${post.user_id?.slice(0, 8) || post.id.slice(0, 8)}`}
          </div>
          {post.created_at && (
            <div className="text-xs text-cyan-300/90 font-mono">
              {formatRelativeDate(post.created_at)}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {isOwnPost && (
            <button
              onClick={onDelete}
              className="p-2 text-cyan-300/80 hover:text-red-300 hover:bg-red-900/15 border border-transparent hover:border-red-500/25 rounded transition-all active:scale-95"
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
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded text-xs font-semibold whitespace-nowrap transition-all font-mono border ${
                    post.match_reason.pov_match_rate === 0
                      ? "bg-[#1f1f35] text-cyan-400/40 border-cyan-500/15 cursor-not-allowed"
                      : "bg-fuchsia-900/25 text-fuchsia-300 border-fuchsia-500/18 hover:border-fuchsia-500/45 hover:bg-fuchsia-900/35 cursor-pointer active:scale-95"
                  }`}
                  title={
                    post.match_reason.pov_match_rate === 0
                      ? "No match"
                      : "Click to see your posts that contributed to this match"
                  }
                >
                  {Math.round(post.match_reason.pov_match_rate * 100)}% MATCH
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
