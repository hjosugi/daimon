import React from "react"
import { Heart, Sparkles } from "lucide-react"
import type { Post, User } from "../../api/client"

interface POVListProps {
  post: Post
  currentUser?: User | null
  onPOVClick?: (pov: string) => void
  onPOVLike?: (e: React.MouseEvent, pov: string) => void
  povLikes: Record<string, { liked: boolean; likes: number }>
}

export const POVList: React.FC<POVListProps> = ({
  post,
  currentUser,
  onPOVClick,
  onPOVLike,
  povLikes,
}) => {
  if (!post.povs || post.povs.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {post.povs.map((pov) => {
        // Note: is_auto information is not currently available in the API response
        // This can be added later if needed
        const isAutoTag = false
        const povLikeStatus = povLikes[pov] || { liked: false, likes: 0 }
        
        return (
          <div key={pov} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPOVClick?.(pov)}
              className={`px-2 py-1 rounded text-xs font-mono transition-all cursor-pointer border active:scale-95 flex items-center gap-1 ${
                isAutoTag
                  ? "bg-fuchsia-900/25 text-fuchsia-300 hover:bg-fuchsia-900/35 border-fuchsia-500/30 hover:border-fuchsia-500/45"
                  : "bg-cyan-900/25 text-cyan-300 hover:bg-cyan-900/35 border-cyan-500/30 hover:border-cyan-500/45"
              }`}
              title={isAutoTag ? "Auto-generated POV" : "Manual POV"}
            >
              {isAutoTag && (
                <Sparkles size={10} className="text-fuchsia-400/80" />
              )}
              <span>#{pov}</span>
            </button>
            {currentUser && (
              <button
                type="button"
                onClick={(e) => onPOVLike?.(e, pov)}
                className={`p-1 rounded transition-all active:scale-95 border border-transparent ${
                  povLikeStatus.liked
                    ? "text-red-300 hover:text-red-300 hover:bg-red-900/15 hover:border-red-500/25"
                    : "text-cyan-400/60 hover:text-red-300 hover:bg-red-900/10 hover:border-red-500/20"
                }`}
                title={povLikeStatus.liked ? "Unlike this POV" : "Like this POV"}
              >
                <Heart
                  size={12}
                  className={povLikeStatus.liked ? "fill-current" : ""}
                />
              </button>
            )}
            {povLikeStatus.likes > 0 && (
              <span className="text-xs text-cyan-400/70 ml-0.5 font-mono">
                {povLikeStatus.likes}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
