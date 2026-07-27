import { Trash2 } from "lucide-react"
import type React from "react"
import { memo } from "react"
import type { Post, User } from "../../api/client"
import { useI18n } from "../../i18n"
import { formatRelativeDate } from "../../utils/date"
import { formatMatchReason } from "../../utils/matchReason"

interface PostHeaderProps {
  post: Post
  currentUser?: User | null
  onDelete?: () => void
  onMatchDetailsClick?: () => void
  onUserClick?: (userId: string) => void
}

const PostHeaderComponent: React.FC<PostHeaderProps> = ({
  post,
  currentUser,
  onDelete,
  onMatchDetailsClick,
  onUserClick,
}) => {
  const { locale, t } = useI18n()
  const isOwnPost = currentUser && post.user_id === currentUser.id
  const username =
    post.username || `USER_${post.user_id?.slice(0, 8) || post.id.slice(0, 8)}`
  const canOpenUser = !!(onUserClick && post.user_id)

  return (
    <div className="p-3 sm:p-4 border-b border-cyan-500/15 bg-[#1f1f35]">
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Avatar */}
        <button
          type="button"
          onClick={() => canOpenUser && onUserClick?.(post.user_id as string)}
          disabled={!canOpenUser}
          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-cyan-400/90 via-fuchsia-400/90 to-cyan-500/90 flex items-center justify-center text-black font-bold text-sm sm:text-base border border-cyan-500/18 flex-shrink-0 font-mono ${canOpenUser ? "cursor-pointer hover:brightness-110 active:scale-95 transition-all" : ""}`}
        >
          {post.username
            ? post.username.slice(0, 1).toUpperCase()
            : post.id.slice(0, 1).toUpperCase()}
        </button>

        {/* User info */}
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => canOpenUser && onUserClick?.(post.user_id as string)}
            disabled={!canOpenUser}
            className={`block text-left text-sm sm:text-base font-semibold text-cyan-300 truncate font-mono ${canOpenUser ? "hover:text-cyan-200 cursor-pointer" : ""}`}
          >
            {username}
          </button>
          {post.created_at && (
            <div className="text-xs text-cyan-300/90 font-mono">
              {formatRelativeDate(post.created_at, locale)}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {isOwnPost && (
            <button
              type="button"
              onClick={onDelete}
              className="p-2 text-cyan-300/80 hover:text-red-300 hover:bg-red-900/15 border border-transparent hover:border-red-500/25 rounded transition-all active:scale-95"
              title={t("post.deletePost")}
            >
              <Trash2 size={18} />
            </button>
          )}
          {!isOwnPost && (
            <div className="flex items-center gap-2">
              {post.match_reason?.is_bridge && (
                <span
                  className="px-2 py-1 sm:py-1.5 rounded text-xs font-semibold whitespace-nowrap font-mono border bg-amber-900/25 text-amber-300 border-amber-500/25"
                  title={
                    formatMatchReason(post.match_reason, t) ||
                    t("post.bridgeTitle")
                  }
                >
                  🌉 {t("post.bridge")}
                </span>
              )}
              {post.match_reason?.pov_match_rate !== undefined && (
                <button
                  type="button"
                  onClick={onMatchDetailsClick}
                  className="px-2 sm:px-3 py-1 sm:py-1.5 rounded text-xs font-semibold whitespace-nowrap transition-all font-mono border bg-fuchsia-900/25 text-fuchsia-300 border-fuchsia-500/18 hover:border-fuchsia-500/45 hover:bg-fuchsia-900/35 cursor-pointer active:scale-95"
                  title={t("post.matchTitle")}
                >
                  {t("post.matchPercent", {
                    percent: Math.round(post.match_reason.pov_match_rate * 100),
                  })}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export const PostHeader = memo(PostHeaderComponent)
