import { motion, AnimatePresence } from "framer-motion"
import { Send, Trash2, AlertTriangle, X, Heart, MessageSquare } from "lucide-react"
import React, { useState, useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { Post, User } from "../api/client"
import { likePost, unlikePost, getComments, addComment, deletePost, likePOV, unlikePOV, getPOVLikeStatus } from "../api/client"
import { PostHeader } from "./PostCard/PostHeader"
import { PostContent } from "./PostCard/PostContent"

interface PostCardProps {
  post: Post
  onTagClick?: (tag: string) => void
  currentUser?: User | null
}

export const PostCard: React.FC<PostCardProps> = ({ post, onTagClick, currentUser }) => {
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState("")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showMatchDetails, setShowMatchDetails] = useState(false)
  const [showMatchReasonDetails, setShowMatchReasonDetails] = useState(false)
  const [povLikes, setPovLikes] = useState<Record<string, { liked: boolean; likes: number }>>({})
  const queryClient = useQueryClient()

  // Like mutation
  const likeMutation = useMutation({
    mutationFn: () => (post.liked ? unlikePost(post.id) : likePost(post.id)),
    onSuccess: (data) => {
      // Optimistically update the post
      queryClient.setQueryData(["timeline"], (oldData: any) => {
        if (!oldData) return oldData
        return oldData.map((p: Post) =>
          p.id === post.id
            ? { ...p, liked: data.liked, likes: data.likes }
            : p
        )
      })
      queryClient.setQueryData(["search"], (oldData: any) => {
        if (!oldData) return oldData
        return oldData.map((p: Post) =>
          p.id === post.id
            ? { ...p, liked: data.liked, likes: data.likes }
            : p
        )
      })
      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["timeline"] })
      queryClient.invalidateQueries({ queryKey: ["search"] })
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

  // Load POV like statuses
  useEffect(() => {
    if (!currentUser || !post.povs) return
    
    const loadPOVLikes = async () => {
      const likes: Record<string, { liked: boolean; likes: number }> = {}
      for (const pov of post.povs) {
        try {
          const status = await getPOVLikeStatus(pov)
          likes[pov] = status
        } catch (error) {
          console.error(`Failed to get like status for POV ${pov}`, error)
          likes[pov] = { liked: false, likes: 0 }
        }
      }
      setPovLikes(likes)
    }
    
    loadPOVLikes()
  }, [post.povs, currentUser])

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
    const currentStatus = povLikes[pov]
    if (currentStatus) {
      povLikeMutation.mutate({ pov, liked: currentStatus.liked })
    }
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
    <motion.div
      id={`post-${post.id}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-white rounded-xl sm:rounded-2xl shadow-md hover:shadow-lg transition-all border border-slate-200/50 overflow-hidden"
    >
      <PostHeader
        post={post}
        currentUser={currentUser}
        onDelete={() => setShowDeleteConfirm(true)}
        onMatchDetailsClick={() => setShowMatchDetails(true)}
      />

      {/* Match Reason Details Modal */}
      {showMatchReasonDetails && post.match_reason && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" 
          onClick={() => setShowMatchReasonDetails(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-white text-lg">💡</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Why This Matched</h3>
                  <p className="text-xs text-white/80">
                    Match reason details
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMatchReasonDetails(false)}
                className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
              {post.match_reason.common_povs.length > 0 && (
                <div className="p-3 bg-gradient-to-r from-blue-50/50 to-purple-50/50 rounded-lg border border-blue-100">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🏷️</span>
                    <span className="text-sm font-semibold text-slate-700">Common POVs</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {post.match_reason.common_povs.map((pov) => (
                      <span key={pov} className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        #{pov}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {post.match_reason.pov_matches && post.match_reason.pov_matches.length > 0 && (
                <div className="p-3 bg-gradient-to-r from-purple-50/50 to-pink-50/50 rounded-lg border border-purple-100">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🏷️</span>
                    <span className="text-sm font-semibold text-slate-700">Matched POVs</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {post.match_reason.pov_matches.map((pov) => (
                      <span key={pov} className="px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                        #{pov}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {post.match_reason.similar_to_user_posts && post.match_reason.similar_to_user_posts.length > 0 && (
                <div className="p-3 bg-gradient-to-r from-blue-50/50 to-purple-50/50 rounded-lg border border-blue-100">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">🔗</span>
                    <span className="text-sm font-semibold text-slate-700">Your Posts That Contributed</span>
                  </div>
                  <div className="space-y-2">
                    {post.match_reason.similar_to_user_posts.map((userPost, index) => (
                      <div
                        key={userPost.id}
                        className="p-3 bg-white rounded-lg border border-blue-200 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="text-xs font-medium text-slate-500">Post #{index + 1}</span>
                          {userPost.similarity_score !== undefined && (
                            <span className="text-xs text-blue-600 font-bold">
                              {Math.round(userPost.similarity_score * 100)}% similar
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed">
                          {userPost.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setShowMatchReasonDetails(false)}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Match Details Modal (for similar user posts - shown when POV match is clicked) */}
      {showMatchDetails && post.match_reason?.similar_to_user_posts && post.match_reason.similar_to_user_posts.length > 0 && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" 
          onClick={() => setShowMatchDetails(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-white text-lg">🏷️</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Match Details</h3>
                  <p className="text-xs text-white/80">
                    {post.match_reason.similar_to_user_posts.length} of your posts contributed to this match
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMatchDetails(false)}
                className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3">
              {post.match_reason.similar_to_user_posts.slice(0, 3).map((userPost, index) => (
                <motion.div
                  key={userPost.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 bg-gradient-to-r from-purple-50/50 to-pink-50/50 rounded-lg border border-purple-200 hover:border-purple-300 transition-colors cursor-pointer"
                  onClick={() => {
                    // Scroll to the post if it exists in the timeline
                    const postElement = document.getElementById(`post-${userPost.id}`)
                    if (postElement) {
                      postElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      postElement.classList.add('ring-2', 'ring-purple-400', 'ring-offset-2')
                      setTimeout(() => {
                        postElement.classList.remove('ring-2', 'ring-purple-400', 'ring-offset-2')
                      }, 2000)
                    }
                    setShowMatchDetails(false)
                  }}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xs font-bold">
                        {index + 1}
                      </div>
                      <span className="text-xs font-semibold text-slate-600">Your post</span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed break-words">
                    {userPost.text}
                  </p>
                  <p className="text-xs text-purple-600 mt-2 font-medium">Click to view →</p>
                </motion.div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setShowMatchDetails(false)}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="text-red-600" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Delete Post</h3>
                <p className="text-sm text-slate-600">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-slate-700">
              Deleting this post will also delete all comments and likes.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deletePostMutation.isPending}
                className="flex-1 py-2.5 px-4 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deletePostMutation.mutate()}
                disabled={deletePostMutation.isPending}
                className="flex-1 py-2.5 px-4 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deletePostMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Delete</span>
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

      {/* Post Actions - Twitter/Mixi style */}
      <div className="px-4 sm:px-5 py-3 sm:py-4 border-t border-slate-100 bg-gradient-to-r from-slate-50 via-blue-50/30 to-purple-50/20">
        <div className="flex items-center gap-4 sm:gap-8">
          {/* Like Button */}
          <button
            onClick={handleLike}
            disabled={likeMutation.isPending}
            className={`flex items-center gap-1.5 sm:gap-2 transition-all group px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg ${
              post.liked
                ? "text-red-500 bg-red-50 hover:bg-red-100"
                : "text-slate-600 hover:text-red-500 hover:bg-red-50/50"
            } ${likeMutation.isPending ? "opacity-50 cursor-wait" : ""}`}
          >
            <Heart
              size={18}
              className={`sm:w-5 sm:h-5 transition-all ${
                post.liked
                  ? "fill-red-500 stroke-red-500"
                  : "group-hover:fill-red-500 group-hover:stroke-red-500"
              } ${likeMutation.isPending ? "animate-pulse" : ""}`}
            />
            <span className="text-xs sm:text-sm font-semibold">
              {likeMutation.isPending ? "..." : (post.likes ?? 0)}
            </span>
          </button>

          {/* Comment Button */}
          <button
            onClick={() => setShowComments(!showComments)}
            className={`flex items-center gap-1.5 sm:gap-2 transition-all group px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg ${
              showComments
                ? "text-blue-600 bg-blue-50"
                : "text-slate-600 hover:text-blue-600 hover:bg-blue-50/50"
            }`}
          >
            <MessageSquare
              size={18}
              className={`sm:w-5 sm:h-5 transition-colors ${
                showComments
                  ? "stroke-blue-600 fill-blue-100"
                  : "group-hover:stroke-blue-600"
              }`}
            />
            <span className="text-xs sm:text-sm font-semibold">
              {post.commentCount ?? comments.length ?? 0}
            </span>
          </button>

        </div>

        {/* Comments Section */}
        <AnimatePresence>
          {showComments && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-4 pt-4 border-t border-slate-200 overflow-hidden"
            >
              {/* Comment Form */}
              <form onSubmit={handleAddComment} className="mb-4">
                <div className="flex gap-2 items-center">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    U
                  </div>
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 px-4 py-2.5 bg-white rounded-xl border-2 border-slate-200 focus:ring-2 focus:ring-blue-200 focus:border-blue-400 text-slate-700 placeholder:text-slate-400 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={!commentText.trim() || addCommentMutation.isPending}
                    className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg flex items-center gap-1"
                  >
                    <Send size={16} />
                    <span className="text-xs font-medium">Send</span>
                  </button>
                </div>
              </form>

              {/* Comments List */}
              <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                {comments.length === 0 ? (
                  <div className="text-center py-6 text-sm text-slate-400 bg-slate-50 rounded-lg border border-slate-100">
                    No comments yet
                  </div>
                ) : (
                  comments.map((comment) => (
                    <motion.div
                      key={comment.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-gradient-to-r from-white to-blue-50/30 rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm">
                          {comment.username ? comment.username.slice(0, 1).toUpperCase() : comment.authorId.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-slate-500 mb-1.5 font-medium">
                            {comment.username || `User_${comment.authorId.slice(0, 8)}`}
                          </div>
                          <p className="text-sm text-slate-700 leading-relaxed break-words">
                            {comment.text}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
