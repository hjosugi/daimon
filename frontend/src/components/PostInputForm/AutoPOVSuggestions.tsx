import { Sparkles } from "lucide-react"
import type React from "react"
import { useI18n } from "../../i18n"

interface AutoPOVSuggestionsProps {
  povs: string[]
  isGenerating: boolean
  onAdd: (pov: string) => void
}

export const AutoPOVSuggestions: React.FC<AutoPOVSuggestionsProps> = ({
  povs,
  isGenerating,
  onAdd,
}) => {
  const { t } = useI18n()

  if (povs.length === 0 && !isGenerating) return null

  return (
    <div className="pt-2 border-t border-cyan-500/12">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={14} className="text-fuchsia-300/95" />
        <span className="text-xs font-medium text-fuchsia-300/95 font-mono">
          {t("postForm.povSuggestions")}{" "}
          {isGenerating && `(${t("postForm.analyzing")})`}
        </span>
        {povs.length > 0 && (
          <span className="text-xs text-cyan-300/70 font-mono">
            ({t("postForm.clickToUse")})
          </span>
        )}
      </div>
      {povs.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {povs.map((pov) => (
            <button
              key={pov}
              type="button"
              onClick={() => onAdd(pov)}
              className="group px-2 py-1 bg-fuchsia-900/15 text-fuchsia-300/95 rounded text-xs font-mono hover:bg-fuchsia-900/25 transition-all border border-fuchsia-500/12 hover:border-fuchsia-500/40 flex items-center gap-1 active:scale-95"
              title={t("postForm.addPovTitle")}
            >
              <Sparkles size={10} className="text-fuchsia-300/95" />
              <span>#{pov}</span>
              <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity text-fuchsia-300 font-semibold ml-1">
                +
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-xs text-cyan-300/70 italic font-mono">
          {t("postForm.analyzingText")}
        </div>
      )}
    </div>
  )
}
