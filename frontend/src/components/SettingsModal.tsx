import { X, Settings2 } from "lucide-react"
import type React from "react"

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
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0f0f1f] rounded-lg border border-cyan-500/30 w-full max-w-md mx-auto overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#1a1a2f] border-b border-cyan-500/20 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 size={20} className="text-cyan-400/90" />
            <h2 className="text-xl font-bold text-cyan-400/90 font-mono">TIMELINE SETTINGS</h2>
          </div>
          <button
            onClick={onClose}
            className="text-cyan-400/70 hover:text-cyan-400 hover:bg-cyan-900/10 rounded p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label htmlFor="similarity-weight" className="text-xs font-medium text-cyan-400/80 mb-3 block font-mono">
              DISCOVERY VS EMPATHY ({Math.round(similarityWeight * 100)}% EMPATHY)
            </label>
            <input
              id="similarity-weight"
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={similarityWeight}
              onChange={(e) => onSimilarityWeightChange(Number.parseFloat(e.target.value))}
              className="w-full h-2 bg-[#1a1a2f] rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, rgb(168, 85, 247) 0%, rgb(168, 85, 247) ${similarityWeight * 100}%, rgb(6, 182, 212) ${similarityWeight * 100}%, rgb(6, 182, 212) 100%)`,
              }}
            />
            <div className="flex justify-between text-xs text-cyan-400/60 mt-2 font-mono">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-fuchsia-400/80 rounded-full"></span>
                DISCOVERY
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-cyan-400/80 rounded-full"></span>
                EMPATHY
              </span>
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-cyan-500/15">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={boostPopular}
                onChange={(e) => onBoostPopularChange(e.target.checked)}
                className="w-5 h-5 text-cyan-500 rounded focus:ring-cyan-500/30 cursor-pointer bg-[#1a1a2f] border-cyan-500/30"
              />
              <span className="text-sm text-cyan-400/80 group-hover:text-cyan-400 font-mono">BOOST POPULAR POSTS</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={includeFarPosts}
                onChange={(e) => onIncludeFarPostsChange(e.target.checked)}
                className="w-5 h-5 text-fuchsia-500 rounded focus:ring-fuchsia-500/30 cursor-pointer bg-[#1a1a2f] border-fuchsia-500/30"
              />
              <span className="text-sm text-cyan-400/80 group-hover:text-cyan-400 font-mono">INCLUDE DIVERSE POSTS (DISCOVERY MODE)</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
