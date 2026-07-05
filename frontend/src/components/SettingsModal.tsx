import { Languages } from "lucide-react"
import type React from "react"
import { type Locale, localeLabels, locales, useI18n } from "../i18n"
import { ModalFrame } from "./ui/ModalFrame"

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  similarityWeight: number
  onSimilarityWeightChange: (weight: number) => void
  boostPopular: boolean
  onBoostPopularChange: (boost: boolean) => void
  includeFarPosts: boolean
  onIncludeFarPostsChange: (include: boolean) => void
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  similarityWeight,
  onSimilarityWeightChange,
  boostPopular,
  onBoostPopularChange,
  includeFarPosts,
  onIncludeFarPostsChange,
}) => {
  const { locale, setLocale, t } = useI18n()
  if (!isOpen) return null

  return (
    <ModalFrame title={t("settings.title")} onClose={onClose}>
      <div className="p-6 space-y-5">
        <div>
          <label
            htmlFor="similarity-weight"
            className="text-xs font-medium text-cyan-300/95 mb-3 block font-mono"
          >
            {t("settings.discoveryVsEmpathy", {
              percent: Math.round(similarityWeight * 100),
            })}
          </label>
          <input
            id="similarity-weight"
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={similarityWeight}
            onChange={(e) =>
              onSimilarityWeightChange(Number.parseFloat(e.target.value))
            }
            className="w-full h-2 bg-[#1f1f3a] rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, rgb(168, 85, 247) 0%, rgb(168, 85, 247) ${similarityWeight * 100}%, rgb(6, 182, 212) ${similarityWeight * 100}%, rgb(6, 182, 212) 100%)`,
            }}
          />
          <div className="flex justify-between text-xs text-cyan-300/80 mt-2 font-mono">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-fuchsia-400/80 rounded-full"></span>
              {t("settings.discovery")}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-cyan-400/80 rounded-full"></span>
              {t("settings.empathy")}
            </span>
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t border-cyan-500/15">
          <label className="flex items-center gap-3 cursor-pointer group relative">
            <div className="relative flex-shrink-0">
              <input
                type="checkbox"
                checked={boostPopular}
                onChange={(e) => onBoostPopularChange(e.target.checked)}
                className="w-5 h-5 appearance-none rounded border-2 border-cyan-500/40 bg-[#1f1f3a] cursor-pointer transition-all checked:bg-cyan-500/90 checked:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 focus:outline-none"
              />
              {boostPopular && (
                <svg
                  aria-hidden="true"
                  focusable="false"
                  className="absolute top-0 left-0 w-5 h-5 pointer-events-none text-black"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </div>
            <span className="text-sm text-cyan-300/95 group-hover:text-cyan-400 font-mono">
              {t("settings.boostPopular")}
            </span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer group relative">
            <div className="relative flex-shrink-0">
              <input
                type="checkbox"
                checked={includeFarPosts}
                onChange={(e) => onIncludeFarPostsChange(e.target.checked)}
                className="w-5 h-5 appearance-none rounded border-2 border-fuchsia-500/40 bg-[#1f1f3a] cursor-pointer transition-all checked:bg-fuchsia-500/90 checked:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/30 focus:outline-none"
              />
              {includeFarPosts && (
                <svg
                  aria-hidden="true"
                  focusable="false"
                  className="absolute top-0 left-0 w-5 h-5 pointer-events-none text-black"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </div>
            <span className="text-sm text-cyan-300/95 group-hover:text-cyan-400 font-mono">
              {t("settings.includeDiverse")}
            </span>
          </label>
        </div>

        <div className="pt-4 border-t border-cyan-500/15">
          <label
            htmlFor="locale-select"
            className="flex items-center justify-between gap-3 text-sm text-cyan-300/85 font-mono"
          >
            <span className="flex items-center gap-2">
              <Languages size={16} className="text-cyan-300/75" />
              {t("locale.switch")}
            </span>
            <select
              id="locale-select"
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
              className="min-w-28 rounded border border-cyan-500/18 bg-[#1f1f35] px-2 py-1 text-xs text-cyan-200 outline-none transition-colors hover:border-cyan-500/35 focus:border-cyan-400/60"
            >
              {locales.map((item) => (
                <option key={item} value={item} className="bg-[#151520]">
                  {localeLabels[item]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </ModalFrame>
  )
}
