import { X } from "lucide-react"
import type { Post } from "../../api/client"
import { useI18n } from "../../i18n"

interface MatchReasonDetailsModalProps {
  post: Post
  onClose: () => void
}

export const MatchReasonDetailsModal: React.FC<
  MatchReasonDetailsModalProps
> = ({ post, onClose }) => {
  const { t } = useI18n()
  const matchReason = post.match_reason

  if (!matchReason) return null

  const similarPosts = matchReason.similar_to_user_posts ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <button
        type="button"
        aria-label={t("common.close")}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div className="relative z-10 bg-[#0f0f1f] rounded-lg border border-cyan-500/18 w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <div className="bg-[#1f1f3a] border-b border-cyan-500/12 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-cyan-900/20 border border-cyan-500/18 flex items-center justify-center">
              <span className="text-cyan-200/95 text-lg">💡</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-cyan-200/95 font-mono">
                {t("post.whyMatched")}
              </h3>
              <p className="text-xs text-cyan-300/80 font-mono">
                {t("post.matchReasonDetails")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-cyan-300/90 hover:text-cyan-400 hover:bg-cyan-900/10 rounded p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {matchReason.common_povs.length > 0 && (
            <div className="p-3 bg-cyan-900/20 rounded-lg border border-cyan-500/12">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🏷️</span>
                <span className="text-xs font-semibold text-cyan-200/95 font-mono">
                  {t("post.commonPovs")}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {matchReason.common_povs.map((pov) => (
                  <span
                    key={pov}
                    className="px-2 py-1 bg-cyan-900/30 text-cyan-200/95 rounded text-xs font-mono border border-cyan-500/18"
                  >
                    #{pov}
                  </span>
                ))}
              </div>
            </div>
          )}

          {matchReason.pov_matches?.length > 0 && (
            <div className="p-3 bg-fuchsia-900/20 rounded-lg border border-fuchsia-500/12">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🏷️</span>
                <span className="text-xs font-semibold text-fuchsia-300/95 font-mono">
                  {t("post.matchedPovs")}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {matchReason.pov_matches.map((pov) => (
                  <span
                    key={pov}
                    className="px-2 py-1 bg-fuchsia-900/30 text-fuchsia-300/95 rounded text-xs font-mono border border-fuchsia-500/18"
                  >
                    #{pov}
                  </span>
                ))}
              </div>
            </div>
          )}

          {similarPosts.length > 0 && (
            <div className="p-3 bg-cyan-900/20 rounded-lg border border-cyan-500/12">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🔗</span>
                <span className="text-xs font-semibold text-cyan-200/95 font-mono">
                  {t("post.yourPostsContributed")}
                </span>
              </div>
              <div className="space-y-2">
                {similarPosts.map((userPost, index) => (
                  <div
                    key={userPost.id}
                    className="p-3 bg-[#1f1f3a] rounded-lg border border-cyan-500/15"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-xs font-medium text-cyan-300/80 font-mono">
                        {t("post.postNumber", { index: index + 1 })}
                      </span>
                      {userPost.similarity_score !== undefined && (
                        <span className="text-xs text-cyan-200/95 font-bold font-mono">
                          {Math.round(userPost.similarity_score * 100)}%{" "}
                          {t("post.similar")}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-cyan-300/90 leading-relaxed">
                      {userPost.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-cyan-500/15 bg-[#1f1f3a]">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-500/90 to-fuchsia-500/90 text-black rounded font-medium hover:from-cyan-400 hover:to-fuchsia-400 transition-colors font-mono font-bold"
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  )
}
