import { Flag, Hash } from "lucide-react"
import type React from "react"
import type { POVCommentStance } from "../../api/client"
import { useI18n } from "../../i18n"
import { stanceBarColors, stanceOrder, stanceSymbols } from "./stanceStyles"

interface POVHeroProps {
  pov: string
  postsCount: number
  commentsCount: number
  stanceCounts: Record<POVCommentStance, number>
  stanceLabels: Record<POVCommentStance, string>
  stood: boolean
  standCount: number
  onToggleStand: () => void
}

export const POVHero: React.FC<POVHeroProps> = ({
  pov,
  postsCount,
  commentsCount,
  stanceCounts,
  stanceLabels,
  stood,
  standCount,
  onToggleStand,
}) => {
  const { t } = useI18n()

  return (
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
            {t("pov.description")}
          </p>
          <div className="mt-2 flex gap-3 text-xs font-mono text-cyan-300/70">
            <span>
              {postsCount} {t("common.posts")}
            </span>
            <span>
              {commentsCount} {t("common.comments")}
            </span>
          </div>
          {commentsCount > 0 && (
            <div className="mt-3">
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-[#151520]">
                {stanceOrder.map((key) =>
                  stanceCounts[key] > 0 ? (
                    <div
                      key={key}
                      className={stanceBarColors[key]}
                      style={{
                        width: `${(stanceCounts[key] / commentsCount) * 100}%`,
                      }}
                    />
                  ) : null,
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-mono text-cyan-300/70">
                {stanceOrder.map((key) => (
                  <span
                    key={key}
                    role="img"
                    className="flex items-center gap-1"
                    title={stanceLabels[key]}
                    aria-label={`${stanceLabels[key]}: ${stanceCounts[key]}`}
                  >
                    <span aria-hidden="true" className="text-sm leading-none">
                      {stanceSymbols[key]}
                    </span>
                    <span aria-hidden="true">{stanceCounts[key]}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onToggleStand}
          className={`shrink-0 flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded border font-mono transition-colors ${
            stood
              ? "border-fuchsia-500/50 bg-fuchsia-900/30 text-fuchsia-100"
              : "border-cyan-500/20 text-cyan-300/80 hover:border-fuchsia-500/40 hover:text-fuchsia-200"
          }`}
          title={stood ? t("pov.unstandTitle") : t("pov.standTitle")}
          aria-label={stood ? t("pov.unstandTitle") : t("pov.standTitle")}
          aria-pressed={stood}
        >
          <Flag size={16} className={stood ? "fill-fuchsia-300/40" : ""} />
          <span className="text-sm font-bold leading-none">{standCount}</span>
        </button>
      </div>
    </section>
  )
}
