import { Send } from "lucide-react"
import type React from "react"
import type { Comment } from "../../api/client"
import { useI18n } from "../../i18n"

interface CommentsPanelProps {
  comments: Comment[]
  commentText: string
  isAdding: boolean
  onCommentTextChange: (text: string) => void
  onAddComment: () => void
}

export const CommentsPanel: React.FC<CommentsPanelProps> = ({
  comments,
  commentText,
  isAdding,
  onCommentTextChange,
  onAddComment,
}) => {
  const { t } = useI18n()

  return (
    <div className="mt-4 pt-4 border-t border-cyan-500/15 overflow-hidden">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onAddComment()
        }}
        className="mb-4"
      >
        <div className="flex gap-2 items-center">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400/90 to-fuchsia-400/90 flex items-center justify-center text-black text-xs font-bold flex-shrink-0 border border-cyan-500/18 font-mono">
            U
          </div>
          <input
            type="text"
            value={commentText}
            onChange={(e) => onCommentTextChange(e.target.value)}
            placeholder={t("post.addComment")}
            className="flex-1 px-4 py-2.5 bg-[#2a2a50] rounded border border-cyan-500/15 focus:ring-1 focus:ring-cyan-500/30 focus:border-cyan-500/40 text-cyan-300 placeholder:text-cyan-300/80 text-sm font-mono transition-all"
          />
          <button
            type="submit"
            disabled={!commentText.trim() || isAdding}
            className="px-4 py-2.5 bg-gradient-to-r from-cyan-500/95 to-fuchsia-500/95 text-black rounded hover:from-cyan-400 hover:to-fuchsia-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1 font-mono font-bold"
          >
            <Send size={16} />
            <span className="text-xs font-medium">{t("common.send")}</span>
          </button>
        </div>
      </form>

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
                    {comment.username || `USER_${comment.authorId.slice(0, 8)}`}
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
  )
}
