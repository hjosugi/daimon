import { Hash } from "lucide-react"
import type React from "react"
import { useI18n } from "../../i18n"
import { POV_CONSTRAINTS } from "../../types/constants"

interface ManualPOVInputProps {
  inputRef: React.RefObject<HTMLInputElement | null>
  value: string
  suggestions: string[]
  showSuggestions: boolean
  onValueChange: (value: string) => void
  onAdd: () => void
  onSuggestionClick: (pov: string) => void
  onShowSuggestionsChange: (show: boolean) => void
}

export const ManualPOVInput: React.FC<ManualPOVInputProps> = ({
  inputRef,
  value,
  suggestions,
  showSuggestions,
  onValueChange,
  onAdd,
  onSuggestionClick,
  onShowSuggestionsChange,
}) => {
  const { t } = useI18n()
  const nearLimit = value.length > POV_CONSTRAINTS.MAX_LENGTH - 50

  return (
    <div className="pt-2 border-t border-cyan-500/12 relative">
      <div className="flex gap-2 items-center">
        <Hash size={14} className="text-cyan-300/80" />
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={value}
            maxLength={POV_CONSTRAINTS.MAX_LENGTH}
            onChange={(e) => onValueChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                if (
                  showSuggestions &&
                  suggestions.length > 0 &&
                  !value.trim()
                ) {
                  onSuggestionClick(suggestions[0])
                } else {
                  onAdd()
                }
              } else if (e.key === "Escape") {
                onShowSuggestionsChange(false)
              } else if (e.key === "ArrowDown") {
                e.preventDefault()
                if (suggestions.length > 0) {
                  onShowSuggestionsChange(true)
                }
              }
            }}
            onFocus={() => {
              if (suggestions.length > 0) {
                onShowSuggestionsChange(true)
              }
            }}
            onBlur={() => {
              setTimeout(() => onShowSuggestionsChange(false), 200)
            }}
            placeholder={t("postForm.addPovPlaceholder")}
            className="w-full px-2 py-1.5 bg-[#1f1f3a] rounded border border-cyan-500/12 focus:ring-1 focus:ring-cyan-500/20 focus:border-cyan-500/18 text-cyan-200/95 placeholder:text-cyan-300/50 text-sm font-mono transition-all"
          />
          {nearLimit && (
            <div className="absolute top-full left-0 right-0 mt-1 text-xs text-cyan-300/70 px-2 font-mono">
              {t("postForm.characterCount", { count: value.length })}
            </div>
          )}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#151520] border border-cyan-500/12 rounded-lg z-50 max-h-48 overflow-y-auto">
              <div className="px-3 py-2 text-xs text-cyan-300/80 border-b border-cyan-500/10 font-mono">
                {value.trim()
                  ? t("postForm.suggestionsFor", { query: value })
                  : t("postForm.popularPovs")}
              </div>
              {suggestions.map((pov) => (
                <button
                  key={pov}
                  type="button"
                  onClick={() => onSuggestionClick(pov)}
                  onMouseDown={(e) => e.preventDefault()}
                  className="w-full px-3 py-2 text-left text-sm text-cyan-200/95 hover:bg-cyan-900/15 transition-colors flex items-center gap-2 font-mono border-b border-cyan-500/8 last:border-b-0"
                >
                  <span className="text-fuchsia-300/90">#</span>
                  <span className="flex-1">{pov}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
