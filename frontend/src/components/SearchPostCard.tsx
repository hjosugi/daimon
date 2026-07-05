import { Bookmark, Hash, Heart, MessageSquare } from "lucide-react"
import type React from "react"
import { memo } from "react"
import type { Post, User } from "../api/client"
import { useI18n } from "../i18n"
import { formatRelativeDate } from "../utils/date"
import { formatMatchReason } from "../utils/matchReason"
import { usePostCardActions } from "./PostCard/usePostCardActions"

interface SearchPostCardProps {
  post: Post
  onTagClick?: (tag: string) => void
  currentUser?: User | null
  onUserClick?: (userId: string) => void
}

const SearchPostCardComponent: React.FC<SearchPostCardProps> = ({
  post,
  onTagClick,
  currentUser,
  onUserClick,
}) => {
  const { locale, t } = useI18n()
  const actions = usePostCardActions(post, currentUser)

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation()
    actions.toggleLike()
  }

  return (
    <article className="post-card group border-b border-cyan-500/15 hover:bg-cyan-500/8 transition-colors">
      <div className="px-2.5 py-2">
        {/* Header - Username and Match Score */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                onUserClick && post.user_id && onUserClick(post.user_id)
              }
              disabled={!(onUserClick && post.user_id)}
              className={`text-[11px] font-mono text-cyan-300 ${onUserClick && post.user_id ? "hover:text-cyan-200 cursor-pointer" : ""}`}
            >
              @{post.username || `u${post.user_id?.slice(0, 6)}`}
            </button>
            {post.created_at && (
              <span className="text-[10px] font-mono text-cyan-300/80">
                · {formatRelativeDate(post.created_at, locale)}
              </span>
            )}
            {post.score !== null && post.score !== undefined && (
              <span className="text-[10px] font-mono text-green-300 bg-green-900/25 px-1 py-0.5 rounded border border-green-500/30">
                {Math.round(post.score * 100)}%
              </span>
            )}
          </div>
          {post.match_reason && (
            <span className="text-[10px] font-mono text-cyan-300 bg-cyan-900/25 px-1 py-0.5 rounded border border-cyan-500/18">
              ✓
            </span>
          )}
        </div>

        {/* Content */}
        <div className="mb-1.5">
          <p className="text-[13px] text-cyan-200 leading-snug break-words">
            {post.text}
          </p>
        </div>

        {/* Why this matched — subtle, revealed on hover */}
        {post.match_reason &&
          (() => {
            const mr = post.match_reason
            const why = formatMatchReason(mr, t)
            if (!why) return null
            return (
              <div className="mb-1.5 text-[11px] font-mono text-cyan-300/60">
                {why}
                {mr.is_bridge && (
                  <span className="ml-1 text-amber-300/75">
                    · {t("post.bridge")}
                  </span>
                )}
              </div>
            )
          })()}

        {/* Tags */}
        {post.povs && post.povs.length > 0 && (
          <div className="flex flex-wrap gap-0.5 mb-1.5">
            {post.povs.slice(0, 3).map((pov) => (
              <button
                type="button"
                key={pov}
                onClick={() => onTagClick?.(pov)}
                className="inline-flex items-center gap-0.5 px-1 py-0.5 text-[10px] font-mono text-fuchsia-300 hover:text-fuchsia-300 hover:bg-fuchsia-900/25 rounded border border-fuchsia-500/18 hover:border-fuchsia-500/45 transition-colors"
              >
                <Hash size={9} />
                {pov.length > 15 ? `${pov.slice(0, 15)}...` : pov}
              </button>
            ))}
            {post.povs.length > 3 && (
              <span className="text-[10px] font-mono text-cyan-300/80 px-1">
                +{post.povs.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 text-[11px]">
          <button
            type="button"
            onClick={handleLike}
            disabled={actions.likePending}
            className={`flex items-center gap-0.5 font-mono transition-colors active:scale-95 ${
              post.liked
                ? "text-red-400"
                : "text-cyan-300/90 hover:text-red-300"
            } ${actions.likePending ? "opacity-50 cursor-wait" : ""}`}
          >
            <Heart size={13} className={post.liked ? "fill-red-400" : ""} />
            <span>{actions.likePending ? "..." : (post.likes ?? 0)}</span>
          </button>
          <div className="flex items-center gap-0.5 text-cyan-300/90 font-mono">
            <MessageSquare size={11} />
            <span>{post.commentCount ?? 0}</span>
          </div>
          {currentUser && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                actions.toggleSave()
              }}
              className={`flex items-center gap-0.5 font-mono transition-colors active:scale-95 ml-auto ${
                actions.saved
                  ? "text-amber-300"
                  : "text-cyan-300/90 hover:text-amber-300"
              }`}
              title={actions.saved ? t("post.savedTitle") : t("post.saveTitle")}
            >
              <Bookmark
                size={12}
                className={actions.saved ? "fill-amber-300" : ""}
              />
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

export const SearchPostCard = memo(SearchPostCardComponent)
