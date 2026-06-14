import { Heart, MessageSquare, Hash } from "lucide-react"
import React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { Post, User } from "../api/client"
import { likePost, unlikePost } from "../api/client"
import { formatRelativeDate } from "../utils/date"

interface SearchPostCardProps {
  post: Post
  onTagClick?: (tag: string) => void
  currentUser?: User | null
}

export const SearchPostCard: React.FC<SearchPostCardProps> = ({ post, onTagClick }) => {
  const queryClient = useQueryClient()

  // Update every cached search result set (key is ["search", query, tags]).
  const patchSearchCaches = (updater: (p: Post) => Post) => {
    queryClient.setQueriesData<Post[]>({ queryKey: ["search"] }, (old) =>
      Array.isArray(old) ? old.map((p) => (p.id === post.id ? updater(p) : p)) : old,
    )
  }

  const likeMutation = useMutation({
    mutationFn: () => (post.liked ? unlikePost(post.id) : likePost(post.id)),
    // Optimistic: flip the heart immediately, no refetch (instant feedback).
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["search"] })
      const prev = queryClient.getQueriesData<Post[]>({ queryKey: ["search"] })
      patchSearchCaches((p) => ({
        ...p,
        liked: !p.liked,
        likes: (p.likes ?? 0) + (p.liked ? -1 : 1),
      }))
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      ctx?.prev?.forEach(([key, data]) => queryClient.setQueryData(key, data))
    },
    onSuccess: (data) => {
      // Reconcile with the server's authoritative count.
      patchSearchCaches((p) => ({ ...p, liked: data.liked, likes: data.likes }))
    },
  })

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation()
    likeMutation.mutate()
  }

  return (
    <div className="border-b border-cyan-500/15 hover:bg-cyan-500/8 transition-colors">
      <div className="px-2.5 py-2">
        {/* Header - Username and Match Score */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono text-cyan-300">@{post.username || `u${post.user_id?.slice(0, 6)}`}</span>
            {post.created_at && (
              <span className="text-[10px] font-mono text-cyan-300/80">
                · {formatRelativeDate(post.created_at)}
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

        {/* Why this matched */}
        {post.match_reason && (() => {
          const mr = post.match_reason
          const why = mr.reason
            ? mr.reason
            : (mr.pov_matches?.length || mr.common_povs?.length)
              ? `共通の視点: ${(mr.pov_matches?.length ? mr.pov_matches : mr.common_povs ?? [])
                  .slice(0, 3)
                  .map((p) => `#${p}`)
                  .join(" ")}`
              : null
          if (!why) return null
          return (
            <div className="mb-1.5 flex items-start gap-1 text-[11px] font-mono text-emerald-200">
              <span className="text-emerald-400 shrink-0">🎯 なぜ表示</span>
              <span className="text-cyan-100/90">{why}</span>
              {mr.is_bridge && (
                <span className="ml-auto shrink-0 text-amber-300" title="遠い視点だが価値観を共有">
                  🌉
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
            onClick={handleLike}
            className={`flex items-center gap-0.5 font-mono transition-colors active:scale-95 ${
              post.liked ? "text-red-400" : "text-cyan-300/90 hover:text-red-300"
            }`}
          >
            <Heart size={13} className={post.liked ? "fill-red-400" : ""} />
            <span>{post.likes ?? 0}</span>
          </button>
          <div className="flex items-center gap-0.5 text-cyan-300/90 font-mono">
            <MessageSquare size={11} />
            <span>{post.commentCount ?? 0}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
