import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Flag, Hash, Loader2, MessageSquare, Send, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import {
  addPOVComment,
  deletePOVComment,
  getPOVComments,
  getPOVLikeStatus,
  likePOV,
  searchPosts,
  unlikePOV,
  type POVComment,
  type POVCommentStance,
  type User,
} from "../api/client"
import { formatRelativeDate } from "../utils/date"
import { SearchPostCard } from "./SearchPostCard"

interface POVDiscussionPageProps {
  pov: string
  user: User | null
  onBack: () => void
  onAuthRequired: () => void
  onUserClick?: (userId: string) => void
  onTagClick?: (tag: string) => void
}

const stanceLabels: Record<POVCommentStance, string> = {
  support: "共感",
  question: "問い",
  oppose: "違和感",
  note: "メモ",
}

const stanceClasses: Record<POVCommentStance, string> = {
  support: "border-emerald-500/30 bg-emerald-900/20 text-emerald-200",
  question: "border-cyan-500/30 bg-cyan-900/20 text-cyan-200",
  oppose: "border-rose-500/30 bg-rose-900/20 text-rose-200",
  note: "border-fuchsia-500/30 bg-fuchsia-900/20 text-fuchsia-200",
}

// Solid fills for the at-a-glance stance distribution (community lean on this 観点).
const stanceBarColors: Record<POVCommentStance, string> = {
  support: "bg-emerald-400/80",
  question: "bg-cyan-400/80",
  oppose: "bg-rose-400/80",
  note: "bg-fuchsia-400/80",
}

const stanceOrder: POVCommentStance[] = ["support", "question", "oppose", "note"]

export const POVDiscussionPage: React.FC<POVDiscussionPageProps> = ({
  pov,
  user,
  onBack,
  onAuthRequired,
  onUserClick,
  onTagClick,
}) => {
  const qc = useQueryClient()
  const [text, setText] = useState("")
  const [stance, setStance] = useState<POVCommentStance>("support")
  const commentsKey = ["pov-comments", pov]

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
      qc.setQueryData<POVComment[]>(commentsKey, (old) => [comment, ...(old ?? [])])
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => deletePOVComment(pov, commentId),
    onSuccess: (_data, commentId) => {
      qc.setQueryData<POVComment[]>(commentsKey, (old) =>
        old ? old.filter((comment) => comment.id !== commentId) : old,
      )
    },
  })

  // Aggregate the community's lean on this 観点 — ErogameScape-style at-a-glance read.
  const stanceCounts = useMemo(() => {
    const c: Record<POVCommentStance, number> = { support: 0, question: 0, oppose: 0, note: 0 }
    for (const cm of comments) c[cm.stance] += 1
    return c
  }, [comments])

  // "この観点に立つ" — endorsing the axis itself (not a post). Identity, not a metric.
  const standKey = ["pov-stand", pov]
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
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(standKey, ctx.prev),
    onSuccess: (data) => qc.setQueryData(standKey, data),
  })
  const toggleStand = () => {
    if (!user) {
      onAuthRequired()
      return
    }
    standMutation.mutate()
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      onAuthRequired()
      return
    }
    if (!text.trim()) return
    addMutation.mutate()
  }

  return (
    <main className="min-h-screen bg-[#151520]">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-4 space-y-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-cyan-300/80 hover:text-cyan-200 font-mono transition-colors"
        >
          <ArrowLeft size={16} />
          戻る
        </button>

        <section className="bg-[#1f1f35] border border-fuchsia-500/20 rounded p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded bg-fuchsia-900/25 border border-fuchsia-500/25 flex items-center justify-center text-fuchsia-200">
              <Hash size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-bold text-fuchsia-100 font-mono break-words">
                {pov}
              </h1>
              <p className="mt-1 text-sm text-cyan-300/75 leading-relaxed">
                この観点について、共感・問い・違和感・補足を交換する場所です。
              </p>
              <div className="mt-2 flex gap-3 text-xs font-mono text-cyan-300/70">
                <span>{posts.length} posts</span>
                <span>{comments.length} comments</span>
              </div>
              {comments.length > 0 && (
                <div className="mt-3">
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-[#151520]">
                    {stanceOrder.map((k) =>
                      stanceCounts[k] > 0 ? (
                        <div
                          key={k}
                          className={stanceBarColors[k]}
                          style={{ width: `${(stanceCounts[k] / comments.length) * 100}%` }}
                        />
                      ) : null,
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-mono text-cyan-300/70">
                    {stanceOrder.map((k) => (
                      <span key={k} className="flex items-center gap-1">
                        <span className={`inline-block w-2 h-2 rounded-sm ${stanceBarColors[k]}`} />
                        {stanceLabels[k]} {stanceCounts[k]}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={toggleStand}
              className={`shrink-0 flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded border font-mono transition-colors ${
                stood
                  ? "border-fuchsia-500/50 bg-fuchsia-900/30 text-fuchsia-100"
                  : "border-cyan-500/20 text-cyan-300/80 hover:border-fuchsia-500/40 hover:text-fuchsia-200"
              }`}
              title={stood ? "この観点から降りる" : "この観点に立つ"}
            >
              <Flag size={16} className={stood ? "fill-fuchsia-300/40" : ""} />
              <span className="text-sm font-bold leading-none">{standCount}</span>
              <span className="text-[9px] leading-none">{stood ? "立っている" : "立つ"}</span>
            </button>
          </div>
        </section>

        <section className="bg-[#1f1f35] border border-cyan-500/15 rounded p-3">
          <div className="flex items-center gap-2 mb-3 text-cyan-200 font-mono text-sm">
            <MessageSquare size={15} />
            <span>POVコメント</span>
          </div>
          <form onSubmit={submit} className="space-y-2">
            <div className="grid grid-cols-4 gap-1.5">
              {(Object.keys(stanceLabels) as POVCommentStance[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStance(key)}
                  className={`px-2 py-1.5 rounded border text-xs font-mono transition-colors ${
                    stance === key
                      ? stanceClasses[key]
                      : "border-cyan-500/15 text-cyan-300/75 hover:border-cyan-500/35"
                  }`}
                >
                  {stanceLabels[key]}
                </button>
              ))}
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 2000))}
              rows={4}
              placeholder={user ? "この観点について意見を書く..." : "ログインするとコメントできます"}
              className="w-full rounded border border-cyan-500/15 bg-[#151520] px-3 py-2 text-sm text-cyan-100 placeholder:text-cyan-300/45 focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 resize-none"
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-cyan-300/55 font-mono">{text.length}/2000</span>
              <button
                type="submit"
                disabled={addMutation.isPending || !text.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-gradient-to-r from-cyan-500/95 to-fuchsia-500/95 text-black text-xs font-bold font-mono disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={13} />
                投稿
              </button>
            </div>
          </form>

          <div className="mt-4 space-y-2">
            {commentsLoading ? (
              <div className="flex justify-center p-6 text-cyan-300">
                <Loader2 size={24} className="animate-spin" />
              </div>
            ) : comments.length === 0 ? (
              <div className="py-6 text-center text-sm text-cyan-300/60 font-mono">
                まだコメントはありません
              </div>
            ) : (
              comments.map((comment) => (
                <article key={comment.id} className="rounded border border-cyan-500/12 bg-[#151520] p-3">
                  <div className="flex items-start gap-2">
                    {comment.avatar_url ? (
                      <img src={comment.avatar_url} alt={comment.username} className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400/90 to-fuchsia-400/90 flex items-center justify-center text-black text-xs font-bold">
                        {comment.username[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onUserClick?.(comment.user_id)}
                          className="text-xs text-cyan-200 hover:text-cyan-100 font-mono truncate"
                        >
                          @{comment.username}
                        </button>
                        <span className={`px-1.5 py-0.5 rounded border text-[10px] font-mono ${stanceClasses[comment.stance]}`}>
                          {stanceLabels[comment.stance]}
                        </span>
                        <span className="text-[10px] text-cyan-300/55 font-mono">
                          {formatRelativeDate(comment.created_at)}
                        </span>
                        {comment.mine && (
                          <button
                            type="button"
                            onClick={() => deleteMutation.mutate(comment.id)}
                            className="ml-auto text-cyan-300/50 hover:text-red-300 transition-colors"
                            title="削除"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-cyan-100/90">
                        {comment.text}
                      </p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="bg-[#1f1f35] border border-cyan-500/15 rounded overflow-hidden">
          <div className="px-3 py-2 border-b border-cyan-500/15 text-sm text-cyan-200 font-mono">
            このPOVが付いた投稿
          </div>
          {postsLoading ? (
            <div className="flex justify-center p-8 text-cyan-300">
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : posts.length === 0 ? (
            <div className="py-8 text-center text-sm text-cyan-300/60 font-mono">投稿がありません</div>
          ) : (
            posts.map((post) => (
              <SearchPostCard
                key={post.id}
                post={post}
                currentUser={user}
                onUserClick={onUserClick}
                onTagClick={onTagClick}
              />
            ))
          )}
        </section>
      </div>
    </main>
  )
}
