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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-md mx-auto overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-purple-500 to-blue-500 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 size={20} className="text-white" />
            <h2 className="text-xl font-bold text-white">Timeline Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label htmlFor="similarity-weight" className="text-sm font-medium text-slate-700 mb-3 block">
              Discovery vs Empathy ({Math.round(similarityWeight * 100)}% Empathy)
            </label>
            <input
              id="similarity-weight"
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={similarityWeight}
              onChange={(e) => onSimilarityWeightChange(Number.parseFloat(e.target.value))}
              className="w-full h-2.5 bg-gradient-to-r from-purple-200 to-blue-200 rounded-full appearance-none cursor-pointer accent-blue-500"
              style={{
                background: `linear-gradient(to right, rgb(196, 181, 253) 0%, rgb(196, 181, 253) ${similarityWeight * 100}%, rgb(191, 219, 254) ${similarityWeight * 100}%, rgb(191, 219, 254) 100%)`,
              }}
            />
            <div className="flex justify-between text-xs text-slate-500 mt-2">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
                Discovery
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                Empathy
              </span>
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-100">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={boostPopular}
                onChange={(e) => onBoostPopularChange(e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-sm text-slate-700 group-hover:text-slate-900">Boost popular posts</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={includeFarPosts}
                onChange={(e) => onIncludeFarPostsChange(e.target.checked)}
                className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
              />
              <span className="text-sm text-slate-700 group-hover:text-slate-900">Include diverse posts (Discovery mode)</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
