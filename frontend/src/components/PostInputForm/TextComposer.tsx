import { Loader2, Send } from "lucide-react"
import type React from "react"
import { useI18n } from "../../i18n"
import { POST_CONSTRAINTS } from "../../types/constants"

interface TextComposerProps {
  value: string
  isSubmitting: boolean
  onChange: (value: string) => void
  onSubmitShortcut: () => void
}

export const TextComposer: React.FC<TextComposerProps> = ({
  value,
  isSubmitting,
  onChange,
  onSubmitShortcut,
}) => {
  const { t } = useI18n()
  const nearLimit = value.length > POST_CONSTRAINTS.MAX_TEXT_LENGTH * 0.95

  return (
    <>
      <label htmlFor="post-content" className="sr-only">
        {t("postForm.title")}
      </label>
      <div className="relative">
        <textarea
          id="post-content"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault()
              if (value.trim() && !isSubmitting) {
                onSubmitShortcut()
              }
            }
          }}
          placeholder={t("postForm.placeholder")}
          maxLength={POST_CONSTRAINTS.MAX_TEXT_LENGTH}
          className="w-full min-h-32 sm:min-h-48 p-3 sm:p-4 pr-12 sm:pr-14 bg-[#2a2a50] rounded-lg border border-cyan-500/15 focus:border-cyan-500/35 focus:ring-1 focus:ring-cyan-500/20 resize-y text-sm sm:text-base text-cyan-100 placeholder:text-cyan-300/70 leading-relaxed font-mono transition-all"
        />
        <button
          type="submit"
          disabled={isSubmitting || !value.trim()}
          className="absolute bottom-3 sm:bottom-4 right-3 sm:right-4 p-2 sm:p-2.5 bg-gradient-to-r from-cyan-500/90 to-fuchsia-500/90 text-black rounded-full hover:from-cyan-400 hover:to-fuchsia-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-mono font-bold"
        >
          {isSubmitting ? (
            <Loader2
              size={16}
              className="sm:w-[18px] sm:h-[18px] animate-spin"
            />
          ) : (
            <Send size={16} className="sm:w-[18px] sm:h-[18px]" />
          )}
        </button>
      </div>
      <div className="flex justify-end -mt-2">
        <span
          className={`text-[11px] font-mono ${
            nearLimit ? "text-fuchsia-400/90" : "text-cyan-300/45"
          }`}
        >
          {value.length.toLocaleString()} /{" "}
          {POST_CONSTRAINTS.MAX_TEXT_LENGTH.toLocaleString()}
        </span>
      </div>
    </>
  )
}
