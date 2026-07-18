import { Loader2, Trash2 } from "lucide-react"
import type React from "react"
import type { POVComment, POVCommentStance } from "../../api/client"
import { useI18n } from "../../i18n"
import { formatRelativeDate } from "../../utils/date"
import { stanceClasses, stanceSymbols } from "./stanceStyles"

interface POVCommentListProps {
  comments: POVComment[]
  isLoading: boolean
  isDeleting: boolean
  stanceLabels: Record<POVCommentStance, string>
  onUserClick?: (userId: string) => void
  onDelete: (commentId: string) => void
}

export const POVCommentList: React.FC<POVCommentListProps> = ({
  comments,
  isLoading,
  isDeleting,
  stanceLabels,
  onUserClick,
  onDelete,
}) => {
  const { locale, t } = useI18n()

  if (isLoading) {
    return (
      <div className="flex justify-center p-6 text-cyan-300">
        <Loader2 size={24} className="animate-spin" />
      </div>
    )
  }

  if (comments.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-cyan-300/60 font-mono">
        {t("pov.noComments")}
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-2">
      {comments.map((comment) => (
        <article
          key={comment.id}
          className="rounded border border-cyan-500/12 bg-[#151520] p-3"
        >
          <div className="flex items-start gap-2">
            {comment.avatar_url ? (
              <img
                src={comment.avatar_url}
                alt={comment.username}
                className="w-8 h-8 rounded-full"
              />
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
                <span
                  role="img"
                  aria-label={stanceLabels[comment.stance]}
                  title={stanceLabels[comment.stance]}
                  className={`inline-flex min-w-7 items-center justify-center px-1.5 py-0.5 rounded border text-sm leading-none ${stanceClasses[comment.stance]}`}
                >
                  <span aria-hidden="true">
                    {stanceSymbols[comment.stance]}
                  </span>
                </span>
                <span className="text-[10px] text-cyan-300/55 font-mono">
                  {formatRelativeDate(comment.created_at, locale)}
                </span>
                {comment.mine && (
                  <button
                    type="button"
                    onClick={() => onDelete(comment.id)}
                    disabled={isDeleting}
                    className="ml-auto text-cyan-300/50 hover:text-red-300 transition-colors disabled:opacity-50"
                    title={t("pov.deleteComment")}
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
      ))}
    </div>
  )
}
