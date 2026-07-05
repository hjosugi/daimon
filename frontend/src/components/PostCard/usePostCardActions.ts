import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import type { Post, User } from "../../api/client"
import {
  addComment,
  deletePost as deletePostRequest,
  getComments,
  likePOV,
  likePost,
  savePost,
  unlikePOV,
  unlikePost,
  unsavePost,
} from "../../api/client"
import { useMutationErrorToast } from "../../hooks/useMutationErrorToast"

const postFeedKeys = [
  ["timeline"],
  ["search"],
  ["my-posts"],
  ["user-posts"],
  ["saved-posts"],
]

export function usePostCardActions(post: Post, currentUser?: User | null) {
  const queryClient = useQueryClient()
  const showMutationError = useMutationErrorToast()
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState("")
  const [saved, setSaved] = useState(Boolean(post.saved))
  const [povLikes, setPovLikes] = useState<
    Record<string, { liked: boolean; likes: number }>
  >(() => post.pov_stats ?? {})

  useEffect(() => {
    setSaved(Boolean(post.saved))
  }, [post.saved])

  useEffect(() => {
    setPovLikes(post.pov_stats ?? {})
  }, [post.pov_stats])

  const patchCaches = (updater: (p: Post) => Post) => {
    for (const key of postFeedKeys) {
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

  const likeMutation = useMutation({
    mutationFn: () => (post.liked ? unlikePost(post.id) : likePost(post.id)),
    onMutate: () => patchCaches(flipLike),
    onError: (error) => {
      patchCaches(flipLike)
      showMutationError(error, "toast.postLikeFailed")
    },
    onSuccess: (data) =>
      patchCaches((p) => ({ ...p, liked: data.liked, likes: data.likes })),
  })

  const saveMutation = useMutation({
    mutationFn: (nextSaved: boolean) =>
      nextSaved ? savePost(post.id) : unsavePost(post.id),
    onMutate: (nextSaved) => {
      const prev = saved
      setSaved(nextSaved)
      patchCaches((p) => ({ ...p, saved: nextSaved }))
      return { prev }
    },
    onError: (error, _v, ctx) => {
      if (!ctx) return
      setSaved(ctx.prev)
      patchCaches((p) => ({ ...p, saved: ctx.prev }))
      showMutationError(error, "toast.postSaveFailed")
    },
    onSuccess: (data) => {
      setSaved(data.saved)
      patchCaches((p) => ({ ...p, saved: data.saved }))
      queryClient.invalidateQueries({ queryKey: ["saved-posts"] })
    },
  })

  const { data: comments = [] } = useQuery({
    queryKey: ["comments", post.id],
    queryFn: () => getComments(post.id),
    enabled: showComments,
  })

  const addCommentMutation = useMutation({
    mutationFn: (text: string) => addComment(post.id, text),
    onSuccess: () => {
      setCommentText("")
      queryClient.invalidateQueries({ queryKey: ["comments", post.id] })
      queryClient.invalidateQueries({ queryKey: ["timeline"] })
    },
    onError: (error) => showMutationError(error, "toast.commentFailed"),
  })

  const deletePostMutation = useMutation({
    mutationFn: () => deletePostRequest(post.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeline"] })
      queryClient.invalidateQueries({ queryKey: ["search"] })
    },
    onError: (error) => showMutationError(error, "toast.deletePostFailed"),
  })

  const povLikeMutation = useMutation({
    mutationFn: ({ pov, liked }: { pov: string; liked: boolean }) =>
      liked ? unlikePOV(pov) : likePOV(pov),
    onSuccess: (data, variables) => {
      setPovLikes((prev) => ({
        ...prev,
        [variables.pov]: data,
      }))
    },
    onError: (error) => showMutationError(error, "toast.povLikeFailed"),
  })

  const togglePOVLike = (pov: string) => {
    if (!currentUser) return
    const currentStatus = povLikes[pov] ?? { liked: false, likes: 0 }
    povLikeMutation.mutate({ pov, liked: currentStatus.liked })
  }

  const addCurrentComment = () => {
    if (!commentText.trim()) return
    addCommentMutation.mutate(commentText)
  }

  return {
    showComments,
    setShowComments,
    commentText,
    setCommentText,
    comments,
    saved,
    povLikes,
    likePending: likeMutation.isPending,
    addCommentPending: addCommentMutation.isPending,
    deletePending: deletePostMutation.isPending,
    toggleLike: () => likeMutation.mutate(),
    toggleSave: () => saveMutation.mutate(!saved),
    addCurrentComment,
    deletePost: () => deletePostMutation.mutate(),
    togglePOVLike,
  }
}

export type PostCardActions = ReturnType<typeof usePostCardActions>
