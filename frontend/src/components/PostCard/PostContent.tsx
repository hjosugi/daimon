import React from "react"
import { POVList } from "./POVList"
import type { Post, User } from "../../api/client"
import { sanitizeText } from "../../utils/security"

interface PostContentProps {
  post: Post
  currentUser?: User | null
  onPOVClick?: (pov: string) => void
  onPOVLike?: (e: React.MouseEvent, pov: string) => void
  povLikes: Record<string, { liked: boolean; likes: number }>
  onTagClick?: (tag: string) => void
}

/**
 * Renders text with hashtag highlighting
 */
function renderTextWithHashtags(text: string): React.ReactNode {
  // Sanitize text to prevent XSS
  const sanitized = sanitizeText(text)
  
  // Split by hashtags and render
  const parts = sanitized.split(/(#\w+)/g)
  return parts.map((part, index) => {
    if (part.startsWith("#")) {
      return (
        <span key={index} className="text-blue-600 font-medium">
          {part}
        </span>
      )
    }
    return <span key={index}>{part}</span>
  })
}

export const PostContent: React.FC<PostContentProps> = ({
  post,
  currentUser,
  onPOVClick,
  onPOVLike,
  povLikes,
  onTagClick: _onTagClick,
}) => {
  return (
    <div className="p-4 sm:p-5 bg-white">
      <p className="text-sm sm:text-base text-slate-800 mb-3 sm:mb-4 leading-relaxed whitespace-pre-wrap break-words">
        {renderTextWithHashtags(post.text)}
      </p>

      <POVList
        post={post}
        currentUser={currentUser}
        onPOVClick={onPOVClick}
        onPOVLike={onPOVLike}
        povLikes={povLikes}
      />
    </div>
  )
}
