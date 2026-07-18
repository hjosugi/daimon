import { MessageSquare, Send } from "lucide-react"
import type React from "react"
import type { POVCommentStance, User } from "../../api/client"
import { useI18n } from "../../i18n"
import { stanceClasses, stanceOrder, stanceSymbols } from "./stanceStyles"

interface POVCommentComposerProps {
  user: User | null
  text: string
  stance: POVCommentStance
  stanceLabels: Record<POVCommentStance, string>
  isPending: boolean
  onTextChange: (text: string) => void
  onStanceChange: (stance: POVCommentStance) => void
  onSubmit: () => void
}

export const POVCommentComposer: React.FC<POVCommentComposerProps> = ({
  user,
  text,
  stance,
  stanceLabels,
  isPending,
  onTextChange,
  onStanceChange,
  onSubmit,
}) => {
  const { t } = useI18n()

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      className="space-y-2"
    >
      <div className="flex items-center gap-2 mb-3 text-cyan-200 font-mono text-sm">
        <MessageSquare size={15} />
        <span>{t("pov.commentsTitle")}</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {stanceOrder.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onStanceChange(key)}
            aria-label={stanceLabels[key]}
            aria-pressed={stance === key}
            title={stanceLabels[key]}
            className={`min-h-11 px-2 py-1.5 rounded border text-xl leading-none transition-all ${
              stance === key
                ? `${stanceClasses[key]} scale-[1.03]`
                : "border-cyan-500/15 bg-[#151520] hover:border-cyan-500/35 hover:bg-cyan-900/10"
            }`}
          >
            <span aria-hidden="true" className="text-xl leading-none">
              {stanceSymbols[key]}
            </span>
          </button>
        ))}
      </div>
      <textarea
        value={text}
        onChange={(e) => onTextChange(e.target.value.slice(0, 2000))}
        rows={4}
        placeholder={
          user ? t("pov.commentPlaceholder") : t("pov.loginToComment")
        }
        className="pov-comment-textarea w-full rounded border border-cyan-500/15 bg-[#151520] px-3 py-2 text-sm text-cyan-100 placeholder:text-cyan-300/45 focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 resize-none"
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-cyan-300/55 font-mono">
          {text.length}/2000
        </span>
        <button
          type="submit"
          disabled={isPending || !text.trim()}
          className="compose-action inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <Send size={13} />
          {t("common.post")}
        </button>
      </div>
    </form>
  )
}
