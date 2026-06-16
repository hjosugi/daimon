import type React from "react"
import { memo, useMemo } from "react"
import type { Post, User } from "../../api/client"
import { sanitizeText } from "../../utils/security"
import { POVList } from "./POVList"

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
  let offset = 0
  return parts.map((part) => {
    const key = `${offset}:${part}`
    offset += part.length
    if (part.startsWith("#")) {
      return (
        <span key={key} className="text-fuchsia-300 font-mono">
          {part}
        </span>
      )
    }
    return <span key={key}>{part}</span>
  })
}

const PostContentComponent: React.FC<PostContentProps> = ({
  post,
  currentUser,
  onPOVClick,
  onPOVLike,
  povLikes,
  onTagClick: _onTagClick,
}) => {
  const renderedText = useMemo(
    () => renderTextWithHashtags(post.text),
    [post.text],
  )

  return (
    <div className="p-4 sm:p-5 bg-[#1f1f35]">
      <p className="text-sm sm:text-base text-cyan-200 mb-3 sm:mb-4 leading-relaxed whitespace-pre-wrap break-words">
        {renderedText}
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

export const PostContent = memo(PostContentComponent)
