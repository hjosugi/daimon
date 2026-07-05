import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import {
  addPOVComment,
  deletePOVComment,
  getPOVComments,
  getPOVLikeStatus,
  likePOV,
  type POVComment,
  type POVCommentStance,
  searchPosts,
  type User,
  unlikePOV,
} from "../../api/client"
import { useMutationErrorToast } from "../../hooks/useMutationErrorToast"

interface UsePOVDiscussionOptions {
  pov: string
  user: User | null
  onAuthRequired: () => void
}

export function usePOVDiscussion({
  pov,
  user,
  onAuthRequired,
}: UsePOVDiscussionOptions) {
  const qc = useQueryClient()
  const showMutationError = useMutationErrorToast()
  const [text, setText] = useState("")
  const [stance, setStance] = useState<POVCommentStance>("support")
  const commentsKey = ["pov-comments", pov]
  const standKey = ["pov-stand", pov]

  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ["pov-posts", pov],
    queryFn: () => searchPosts({ tags: [pov], limit: 30 }),
    staleTime: 1000 * 30,
  })

  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: commentsKey,
    queryFn: () => getPOVComments(pov),
    staleTime: 1000 * 15,
  })

  const addMutation = useMutation({
    mutationFn: () => addPOVComment(pov, text, stance),
    onSuccess: (comment) => {
      setText("")
      qc.setQueryData<POVComment[]>(commentsKey, (old) => [
        comment,
        ...(old ?? []),
      ])
    },
    onError: (error) => showMutationError(error, "toast.povCommentFailed"),
  })

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => deletePOVComment(pov, commentId),
    onSuccess: (_data, commentId) => {
      qc.setQueryData<POVComment[]>(commentsKey, (old) =>
        old ? old.filter((comment) => comment.id !== commentId) : old,
      )
    },
    onError: (error) =>
      showMutationError(error, "toast.povCommentDeleteFailed"),
  })

  const stanceCounts = useMemo(() => {
    const counts: Record<POVCommentStance, number> = {
      support: 0,
      question: 0,
      oppose: 0,
      note: 0,
    }
    for (const comment of comments) {
      counts[comment.stance] += 1
    }
    return counts
  }, [comments])

  const { data: stand } = useQuery({
    queryKey: standKey,
    queryFn: () => getPOVLikeStatus(pov),
    staleTime: 1000 * 30,
  })
  const stood = stand?.liked ?? false
  const standCount = stand?.likes ?? 0

  const standMutation = useMutation({
    mutationFn: () => (stood ? unlikePOV(pov) : likePOV(pov)),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: standKey })
      const prev = qc.getQueryData<{ liked: boolean; likes: number }>(standKey)
      qc.setQueryData<{ liked: boolean; likes: number }>(standKey, (old) => {
        const base = old ?? { liked: false, likes: 0 }
        return { liked: !base.liked, likes: base.likes + (base.liked ? -1 : 1) }
      })
      return { prev }
    },
    onError: (error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(standKey, ctx.prev)
      showMutationError(error, "toast.povStandFailed")
    },
    onSuccess: (data) => qc.setQueryData(standKey, data),
  })

  const toggleStand = () => {
    if (!user) {
      onAuthRequired()
      return
    }
    standMutation.mutate()
  }

  const submitComment = () => {
    if (!user) {
      onAuthRequired()
      return
    }
    if (!text.trim()) return
    addMutation.mutate()
  }

  return {
    text,
    setText,
    stance,
    setStance,
    posts,
    postsLoading,
    comments,
    commentsLoading,
    stanceCounts,
    stood,
    standCount,
    toggleStand,
    submitComment,
    addPending: addMutation.isPending,
    deletePending: deleteMutation.isPending,
    deleteComment: (commentId: string) => deleteMutation.mutate(commentId),
  }
}

export type POVDiscussionController = ReturnType<typeof usePOVDiscussion>
