import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  Bookmark,
  Heart,
  MessageSquare,
  Send,
  Trash2,
  X,
} from "lucide-react"
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

      {/* Match Reason Details Modal */}
      {showMatchReasonDetails && post.match_reason && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setShowMatchReasonDetails(false)}
        >
          <div
            className="bg-[#0f0f1f] rounded-lg border border-cyan-500/18 w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-[#1f1f3a] border-b border-cyan-500/12 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-cyan-900/20 border border-cyan-500/18 flex items-center justify-center">
                  <span className="text-cyan-200/95 text-lg">💡</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-cyan-200/95 font-mono">
                    {t("post.whyMatched")}
                  </h3>
                  <p className="text-xs text-cyan-300/80 font-mono">
                    {t("post.matchReasonDetails")}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMatchReasonDetails(false)}
                className="text-cyan-300/90 hover:text-cyan-400 hover:bg-cyan-900/10 rounded p-1 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
              {post.match_reason.common_povs.length > 0 && (
                <div className="p-3 bg-cyan-900/20 rounded-lg border border-cyan-500/12">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🏷️</span>
                    <span className="text-xs font-semibold text-cyan-200/95 font-mono">
                      {t("post.commonPovs")}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {post.match_reason.common_povs.map((pov) => (
                      <span
                        key={pov}
                        className="px-2 py-1 bg-cyan-900/30 text-cyan-200/95 rounded text-xs font-mono border border-cyan-500/18"
                      >
                        #{pov}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {post.match_reason.pov_matches &&
                post.match_reason.pov_matches.length > 0 && (
                  <div className="p-3 bg-fuchsia-900/20 rounded-lg border border-fuchsia-500/12">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">🏷️</span>
                      <span className="text-xs font-semibold text-fuchsia-300/95 font-mono">
                        {t("post.matchedPovs")}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {post.match_reason.pov_matches.map((pov) => (
                        <span
                          key={pov}
                          className="px-2 py-1 bg-fuchsia-900/30 text-fuchsia-300/95 rounded text-xs font-mono border border-fuchsia-500/18"
                        >
                          #{pov}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              {post.match_reason.similar_to_user_posts &&
                post.match_reason.similar_to_user_posts.length > 0 && (
                  <div className="p-3 bg-cyan-900/20 rounded-lg border border-cyan-500/12">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg">🔗</span>
                      <span className="text-xs font-semibold text-cyan-200/95 font-mono">
                        {t("post.yourPostsContributed")}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {post.match_reason.similar_to_user_posts.map(
                        (userPost, index) => (
                          <div
                            key={userPost.id}
                            className="p-3 bg-[#1f1f3a] rounded-lg border border-cyan-500/15"
                          >
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <span className="text-xs font-medium text-cyan-300/80 font-mono">
                                {t("post.postNumber", { index: index + 1 })}
                              </span>
                              {userPost.similarity_score !== undefined && (
                                <span className="text-xs text-cyan-200/95 font-bold font-mono">
                                  {Math.round(userPost.similarity_score * 100)}%{" "}
                                  {t("post.similar")}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-cyan-300/90 leading-relaxed">
                              {userPost.text}
                            </p>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-cyan-500/15 bg-[#1f1f3a]">
              <button
                onClick={() => setShowMatchReasonDetails(false)}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-500/90 to-fuchsia-500/90 text-black rounded font-medium hover:from-cyan-400 hover:to-fuchsia-400 transition-colors font-mono font-bold"
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Match Details Modal (for similar user posts - shown when POV match is clicked) */}
      {showMatchDetails &&
        post.match_reason?.similar_to_user_posts &&
        post.match_reason.similar_to_user_posts.length > 0 && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setShowMatchDetails(false)}
          >
            <div
              className="bg-[#0f0f1f] rounded-lg border border-fuchsia-500/18 w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-[#1f1f3a] border-b border-fuchsia-500/12 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-fuchsia-900/20 border border-fuchsia-500/18 flex items-center justify-center">
                    <span className="text-fuchsia-300/95 text-lg">🏷️</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-fuchsia-300/95 font-mono">
                      {t("post.matchDetails")}
                    </h3>
                    <p className="text-xs text-fuchsia-400/60 font-mono">
                      {t("post.postsContributed", {
                        count: post.match_reason.similar_to_user_posts.length,
                      })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowMatchDetails(false)}
                  className="text-fuchsia-400/70 hover:text-fuchsia-400 hover:bg-fuchsia-900/10 rounded p-1 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3">
                {post.match_reason.similar_to_user_posts
                  .slice(0, 3)
                  .map((userPost, index) => (
                    <div
                      key={userPost.id}
                      className="p-4 bg-fuchsia-900/20 rounded-lg border border-fuchsia-500/12 hover:border-fuchsia-500/40 transition-colors cursor-pointer"
                      onClick={() => {
                        // Scroll to the post if it exists in the timeline
                        const postElement = document.getElementById(
                          `post-${userPost.id}`,
                        )
                        if (postElement) {
                          postElement.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                          })
                          postElement.classList.add(
                            "ring-2",
                            "ring-fuchsia-400",
                            "ring-offset-2",
                          )
                          setTimeout(() => {
                            postElement.classList.remove(
                              "ring-2",
                              "ring-fuchsia-400",
                              "ring-offset-2",
                            )
                          }, 2000)
                        }
                        setShowMatchDetails(false)
                      }}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-fuchsia-400/80 to-cyan-400/80 flex items-center justify-center text-black text-xs font-bold border border-fuchsia-500/18 font-mono">
                            {index + 1}
                          </div>
                          <span className="text-xs font-semibold text-fuchsia-300/95 font-mono">
                            {t("post.yourPost")}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-cyan-300/90 leading-relaxed break-words">
                        {userPost.text}
                      </p>
                      <p className="text-xs text-fuchsia-300/95 mt-2 font-medium font-mono">
                        {t("post.clickToView")} →
                      </p>
                    </div>
                  ))}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-fuchsia-500/15 bg-[#1f1f3a]">
                <button
                  onClick={() => setShowMatchDetails(false)}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-500/90 to-fuchsia-500/90 text-black rounded font-medium hover:from-cyan-400 hover:to-fuchsia-400 transition-colors font-mono font-bold"
                >
                  {t("common.close")}
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="bg-[#0f0f1f] rounded-lg border border-red-500/30 w-full max-w-md p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-900/30 border border-red-500/30 flex items-center justify-center">
                <AlertTriangle className="text-red-400/90" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-400/90 font-mono">
                  {t("post.deletePost")}
                </h3>
                <p className="text-sm text-red-400/60 font-mono">
                  {t("post.deletePostWarning")}
                </p>
              </div>
            </div>
            <p className="text-sm text-cyan-300/80 font-mono">
              {t("post.deletePostBody")}
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deletePostMutation.isPending}
                className="flex-1 py-2.5 px-4 bg-[#1f1f3a] text-cyan-300/95 border border-cyan-500/12 rounded font-medium hover:bg-[#0f0f1f] hover:border-cyan-500/40 transition-colors disabled:opacity-50 font-mono"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => deletePostMutation.mutate()}
                disabled={deletePostMutation.isPending}
                className="flex-1 py-2.5 px-4 bg-red-600/90 text-white rounded font-medium hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-mono font-bold"
              >
                {deletePostMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>{t("common.deleting")}</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>{t("common.delete")}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
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
