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
              className={`px-3 py-1 rounded-full text-sm font-medium transition-all cursor-pointer border active:scale-95 flex items-center gap-1.5 ${
                isAutoTag
                  ? "bg-gradient-to-r from-purple-50 to-pink-50 text-purple-600 hover:from-purple-100 hover:to-pink-100 border-purple-200"
                  : "bg-gradient-to-r from-blue-50 to-purple-50 text-blue-600 hover:from-blue-100 hover:to-purple-100 border-blue-100"
              }`}
              title={isAutoTag ? "Auto-generated POV" : "Manual POV"}
            >
              {isAutoTag && (
                <Sparkles size={12} className="text-purple-500" />
              )}
              <span>#{pov}</span>
            </button>
            {currentUser && (
              <button
                type="button"
                onClick={(e) => onPOVLike?.(e, pov)}
                className={`p-1 rounded-full transition-all active:scale-95 ${
                  povLikeStatus.liked
                    ? "text-red-500 hover:text-red-600 hover:bg-red-50"
                    : "text-slate-400 hover:text-red-500 hover:bg-red-50"
                }`}
                title={povLikeStatus.liked ? "Unlike this POV" : "Like this POV"}
              >
                <Heart
                  size={14}
                  className={povLikeStatus.liked ? "fill-current" : ""}
                />
              </button>
            )}
            {povLikeStatus.likes > 0 && (
              <span className="text-xs text-slate-500 ml-0.5">
                {povLikeStatus.likes}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
