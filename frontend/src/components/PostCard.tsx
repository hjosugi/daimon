import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Bookmark, Heart, MessageSquare, Send } from "lucide-react"
import type React from "react"
import { memo, useEffect, useState } from "react"
import type { Post, User } from "../api/client"
import {
  addComment,
  deletePost,
  getComments,
  likePOV,
  likePost,
  savePost,
  unlikePOV,
  unlikePost,
  unsavePost,
} from "../api/client"
import { useI18n } from "../i18n"
import { DeletePostDialog } from "./PostCard/DeletePostDialog"
import { MatchDetailsModal } from "./PostCard/MatchDetailsModal"
import { MatchReasonDetailsModal } from "./PostCard/MatchReasonDetailsModal"
import { PostContent } from "./PostCard/PostContent"
import { PostHeader } from "./PostCard/PostHeader"

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
  const { t } = useI18n()
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState("")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showMatchDetails, setShowMatchDetails] = useState(false)
  const [showMatchReasonDetails, setShowMatchReasonDetails] = useState(false)
  const [povLikes, setPovLikes] = useState<
    Record<string, { liked: boolean; likes: number }>
  >(() => post.pov_stats ?? {})
  const queryClient = useQueryClient()

  const [saved, setSaved] = useState(Boolean(post.saved))

  useEffect(() => {
    setSaved(Boolean(post.saved))
  }, [post.saved])

  useEffect(() => {
    setPovLikes(post.pov_stats ?? {})
  }, [post.pov_stats])

  // Patch this post across every cached feed (timeline/search/profile/saved).
  const patchCaches = (updater: (p: Post) => Post) => {
    for (const key of [
      ["timeline"],
      ["search"],
      ["my-posts"],
      ["user-posts"],
      ["saved-posts"],
    ]) {
      queryClient.setQueriesData<Post[]>({ queryKey: key }, (old) =>
        Array.isArray(old)
          ? old.map((p) => (p.id === post.id ? updater(p) : p))
          : old,
      )
    }
  }

  const flipLike = (p: Post): Post => ({
    ...p,
    liked: !p.liked,
    likes: (p.likes ?? 0) + (p.liked ? -1 : 1),
  })

  // Like mutation — optimistic (instant heart, no refetch).
  const likeMutation = useMutation({
    mutationFn: () => (post.liked ? unlikePost(post.id) : likePost(post.id)),
    onMutate: () => patchCaches(flipLike),
    onError: () => patchCaches(flipLike),
    onSuccess: (data) =>
      patchCaches((p) => ({ ...p, liked: data.liked, likes: data.likes })),
  })

  // Save / clip mutation — optimistic.
  const saveMutation = useMutation({
    mutationFn: () => (saved ? unsavePost(post.id) : savePost(post.id)),
    onMutate: () => {
      const prev = saved
      const next = !saved
      setSaved(next)
      patchCaches((p) => ({ ...p, saved: next }))
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (!ctx) return
      setSaved(ctx.prev)
      patchCaches((p) => ({ ...p, saved: ctx.prev }))
    },
    onSuccess: (data) => {
      setSaved(data.saved)
      patchCaches((p) => ({ ...p, saved: data.saved }))
      queryClient.invalidateQueries({ queryKey: ["saved-posts"] })
    },
  })

  // Comments query
  const { data: comments = [] } = useQuery({
    queryKey: ["comments", post.id],
    queryFn: () => getComments(post.id),
    enabled: showComments,
  })

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: (text: string) => addComment(post.id, text),
    onSuccess: () => {
      setCommentText("")
      queryClient.invalidateQueries({ queryKey: ["comments", post.id] })
      queryClient.invalidateQueries({ queryKey: ["timeline"] })
    },
  })

  // Delete post mutation
  const deletePostMutation = useMutation({
    mutationFn: () => deletePost(post.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeline"] })
      queryClient.invalidateQueries({ queryKey: ["search"] })
      setShowDeleteConfirm(false)
    },
  })

  // POV like mutation
  const povLikeMutation = useMutation({
    mutationFn: ({ pov, liked }: { pov: string; liked: boolean }) =>
      liked ? unlikePOV(pov) : likePOV(pov),
    onSuccess: (data, variables) => {
      setPovLikes((prev) => ({
        ...prev,
        [variables.pov]: data,
      }))
    },
  })

  const handlePOVLike = (e: React.MouseEvent, pov: string) => {
    e.stopPropagation() // Prevent tag click
    if (!currentUser) return
    const currentStatus = povLikes[pov] ?? { liked: false, likes: 0 }
    povLikeMutation.mutate({ pov, liked: currentStatus.liked })
  }

  const handleLike = () => {
    likeMutation.mutate()
  }

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim()) return
    addCommentMutation.mutate(commentText)
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
        onMatchDetailsClick={() => setShowMatchDetails(true)}
        onUserClick={onUserClick}
      />

      {showMatchReasonDetails && (
        <MatchReasonDetailsModal
          post={post}
          onClose={() => setShowMatchReasonDetails(false)}
        />
      )}

      {showMatchDetails && (
        <MatchDetailsModal
          post={post}
          onClose={() => setShowMatchDetails(false)}
        />
      )}

      {showDeleteConfirm && (
        <DeletePostDialog
          isDeleting={deletePostMutation.isPending}
          onCancel={() => setShowDeleteConfirm(false)}
          onDelete={() => deletePostMutation.mutate()}
        />
      )}

      <PostContent
        post={post}
        currentUser={currentUser}
        onPOVClick={onTagClick}
        onPOVLike={handlePOVLike}
        povLikes={povLikes}
        onTagClick={onTagClick}
      />

      {/* Post Actions - Cyberpunk style */}
      <div className="px-4 sm:px-5 py-3 sm:py-4 border-t border-cyan-500/15 bg-[#2a2a50]">
        <div className="flex items-center gap-4 sm:gap-8">
          {/* Like Button */}
          <button
            type="button"
            onClick={handleLike}
            disabled={likeMutation.isPending}
            className={`flex items-center gap-1.5 sm:gap-2 transition-all group px-2 sm:px-3 py-1 sm:py-1.5 rounded font-mono border ${
              post.liked
                ? "text-red-300 bg-red-900/15 border-red-500/25"
                : "text-cyan-300/90 hover:text-red-300 hover:bg-red-900/10 border-transparent hover:border-red-500/20"
            } ${likeMutation.isPending ? "opacity-50 cursor-wait" : ""}`}
          >
            <Heart
              size={18}
              className={`sm:w-5 sm:h-5 transition-all ${
                post.liked
                  ? "fill-red-300 stroke-red-300"
                  : "group-hover:fill-red-300 group-hover:stroke-red-300"
              } ${likeMutation.isPending ? "animate-pulse" : ""}`}
            />
            <span className="text-xs sm:text-sm font-semibold">
              {likeMutation.isPending ? "..." : (post.likes ?? 0)}
            </span>
          </button>

          {/* Comment Button */}
          <button
            type="button"
            onClick={() => setShowComments(!showComments)}
            className={`flex items-center gap-1.5 sm:gap-2 transition-all group px-2 sm:px-3 py-1 sm:py-1.5 rounded font-mono border ${
              showComments
                ? "text-cyan-300 bg-cyan-900/15 border-cyan-500/15"
                : "text-cyan-300/90 hover:text-cyan-300 hover:bg-cyan-900/10 border-transparent hover:border-cyan-500/12"
            }`}
          >
            <MessageSquare
              size={18}
              className={`sm:w-5 sm:h-5 transition-colors ${
                showComments ? "stroke-cyan-300" : "group-hover:stroke-cyan-300"
              }`}
            />
            <span className="text-xs sm:text-sm font-semibold">
              {post.commentCount ?? comments.length ?? 0}
            </span>
          </button>

          {/* Save / clip button */}
          {currentUser && (
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              className={`flex items-center gap-1.5 sm:gap-2 transition-all group px-2 sm:px-3 py-1 sm:py-1.5 rounded font-mono border active:scale-95 ml-auto ${
                saved
                  ? "text-amber-300 bg-amber-900/15 border-amber-500/25"
                  : "text-cyan-300/90 hover:text-amber-300 hover:bg-amber-900/10 border-transparent hover:border-amber-500/20"
              }`}
              title={saved ? t("post.savedTitle") : t("post.saveTitle")}
            >
              <Bookmark
                size={18}
                className={`sm:w-5 sm:h-5 ${saved ? "fill-amber-300" : ""}`}
              />
              <span className="text-xs sm:text-sm font-semibold hidden sm:inline">
                {saved ? t("post.saved") : t("post.save")}
              </span>
            </button>
          )}
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="mt-4 pt-4 border-t border-cyan-500/15 overflow-hidden">
            {/* Comment Form */}
            <form onSubmit={handleAddComment} className="mb-4">
              <div className="flex gap-2 items-center">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400/90 to-fuchsia-400/90 flex items-center justify-center text-black text-xs font-bold flex-shrink-0 border border-cyan-500/18 font-mono">
                  U
                </div>
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={t("post.addComment")}
                  className="flex-1 px-4 py-2.5 bg-[#2a2a50] rounded border border-cyan-500/15 focus:ring-1 focus:ring-cyan-500/30 focus:border-cyan-500/40 text-cyan-300 placeholder:text-cyan-300/80 text-sm font-mono transition-all"
                />
                <button
                  type="submit"
                  disabled={!commentText.trim() || addCommentMutation.isPending}
                  className="px-4 py-2.5 bg-gradient-to-r from-cyan-500/95 to-fuchsia-500/95 text-black rounded hover:from-cyan-400 hover:to-fuchsia-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1 font-mono font-bold"
                >
                  <Send size={16} />
                  <span className="text-xs font-medium">
                    {t("common.send")}
                  </span>
                </button>
              </div>
            </form>

            {/* Comments List */}
            <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
              {comments.length === 0 ? (
                <div className="text-center py-6 text-sm text-cyan-300/80 bg-[#1f1f35] rounded-lg border border-cyan-500/15 font-mono">
                  {t("post.noComments")}
                </div>
              ) : (
                comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="bg-[#2a2a50] rounded-lg p-4 border border-cyan-500/15 hover:border-cyan-500/35 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400/90 to-fuchsia-400/90 flex items-center justify-center text-black text-xs font-bold flex-shrink-0 border border-cyan-500/18 font-mono">
                        {comment.username
                          ? comment.username.slice(0, 1).toUpperCase()
                          : comment.authorId.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-cyan-300 mb-1.5 font-medium font-mono">
                          {comment.username ||
                            `USER_${comment.authorId.slice(0, 8)}`}
                        </div>
                        <p className="text-sm text-cyan-200 leading-relaxed break-words">
                          {comment.text}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  )
}

export const PostCard = memo(PostCardComponent)
