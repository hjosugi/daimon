import { MessageSquare, Send } from "lucide-react"
import type React from "react"
import type { POVCommentStance, User } from "../../api/client"
import { useI18n } from "../../i18n"
import { stanceClasses } from "./stanceStyles"

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
        {(Object.keys(stanceLabels) as POVCommentStance[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onStanceChange(key)}
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
        onChange={(e) => onTextChange(e.target.value.slice(0, 2000))}
        rows={4}
        placeholder={
          user ? t("pov.commentPlaceholder") : t("pov.loginToComment")
        }
        className="w-full rounded border border-cyan-500/15 bg-[#151520] px-3 py-2 text-sm text-cyan-100 placeholder:text-cyan-300/45 focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 resize-none"
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-cyan-300/55 font-mono">
          {text.length}/2000
        </span>
        <button
          type="submit"
          disabled={isPending || !text.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-gradient-to-r from-cyan-500/95 to-fuchsia-500/95 text-black text-xs font-bold font-mono disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send size={13} />
          {t("common.post")}
        </button>
      </div>
    </form>
  )
}
