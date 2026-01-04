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

  const likeMutation = useMutation({
    mutationFn: () => (post.liked ? unlikePost(post.id) : likePost(post.id)),
    onSuccess: (data) => {
      queryClient.setQueryData(["search"], (oldData: any) => {
        if (!oldData) return oldData
        return oldData.map((p: Post) =>
          p.id === post.id
            ? { ...p, liked: data.liked, likes: data.likes }
            : p
        )
      })
      queryClient.invalidateQueries({ queryKey: ["search"] })
    },
  })

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation()
    likeMutation.mutate()
  }

  return (
    <div className="border-b border-cyan-500/25 hover:bg-cyan-500/8 transition-colors">
      <div className="px-2.5 py-2">
        {/* Header - Username and Match Score */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono text-cyan-300">@{post.username || `u${post.user_id?.slice(0, 6)}`}</span>
            {post.created_at && (
              <span className="text-[10px] font-mono text-cyan-400/60">
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
            <span className="text-[10px] font-mono text-cyan-300 bg-cyan-900/25 px-1 py-0.5 rounded border border-cyan-500/30">
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

        {/* Tags */}
        {post.povs && post.povs.length > 0 && (
          <div className="flex flex-wrap gap-0.5 mb-1.5">
            {post.povs.slice(0, 3).map((pov) => (
              <button
                key={pov}
                onClick={() => onTagClick?.(pov)}
                className="inline-flex items-center gap-0.5 px-1 py-0.5 text-[10px] font-mono text-fuchsia-300 hover:text-fuchsia-300 hover:bg-fuchsia-900/25 rounded border border-fuchsia-500/30 hover:border-fuchsia-500/45 transition-colors"
              >
                <Hash size={9} />
                {pov.length > 15 ? `${pov.slice(0, 15)}...` : pov}
              </button>
            ))}
            {post.povs.length > 3 && (
              <span className="text-[10px] font-mono text-cyan-400/60 px-1">
                +{post.povs.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 text-[11px]">
          <button
            onClick={handleLike}
            disabled={likeMutation.isPending}
            className={`flex items-center gap-0.5 font-mono transition-colors ${
              post.liked
                ? "text-red-300"
                : "text-cyan-400/70 hover:text-red-300"
            } ${likeMutation.isPending ? "opacity-50" : ""}`}
          >
            <Heart
              size={11}
              className={post.liked ? "fill-red-300" : ""}
            />
            <span>{post.likes ?? 0}</span>
          </button>
          <div className="flex items-center gap-0.5 text-cyan-400/70 font-mono">
            <MessageSquare size={11} />
            <span>{post.commentCount ?? 0}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
