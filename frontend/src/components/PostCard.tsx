import type React from "react"
import { memo, useState } from "react"
import type { Post, User } from "../api/client"
import { DeletePostDialog } from "./PostCard/DeletePostDialog"
import { MatchReasonDetailsModal } from "./PostCard/MatchReasonDetailsModal"
import { PostActions } from "./PostCard/PostActions"
import { PostContent } from "./PostCard/PostContent"
import { PostHeader } from "./PostCard/PostHeader"
import { usePostCardActions } from "./PostCard/usePostCardActions"

interface PostCardProps {
  post: Post
  onTagClick?: (tag: string) => void
  currentUser?: User | null
  onUserClick?: (userId: string) => void
}

const PostCardComponent: React.FC<PostCardProps> = ({
  post,
  onTagClick,
  currentUser,
  onUserClick,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showMatchReasonDetails, setShowMatchReasonDetails] = useState(false)
  const actions = usePostCardActions(post, currentUser)

  const handlePOVLike = (e: React.MouseEvent, pov: string) => {
    e.stopPropagation()
    actions.togglePOVLike(pov)
  }

  const handleDelete = () => {
    actions.deletePost()
    setShowDeleteConfirm(false)
  }

  return (
    <article
      id={`post-${post.id}`}
      className="post-card bg-[#1f1f35] rounded-lg border border-cyan-500/15 hover:border-cyan-500/35 transition-colors overflow-hidden"
    >
      <PostHeader
        post={post}
        currentUser={currentUser}
        onDelete={() => setShowDeleteConfirm(true)}
        onMatchDetailsClick={() => setShowMatchReasonDetails(true)}
        onUserClick={onUserClick}
      />

      {showMatchReasonDetails && (
        <MatchReasonDetailsModal
          post={post}
          onClose={() => setShowMatchReasonDetails(false)}
        />
      )}

      {showDeleteConfirm && (
        <DeletePostDialog
          isDeleting={actions.deletePending}
          onCancel={() => setShowDeleteConfirm(false)}
          onDelete={handleDelete}
        />
      )}

      <PostContent
        post={post}
        currentUser={currentUser}
        onPOVClick={onTagClick}
        onPOVLike={handlePOVLike}
        povLikes={actions.povLikes}
      />

      <PostActions post={post} currentUser={currentUser} actions={actions} />
    </article>
  )
}

export const PostCard = memo(PostCardComponent)
