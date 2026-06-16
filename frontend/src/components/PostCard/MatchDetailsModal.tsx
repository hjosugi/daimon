import { X } from "lucide-react"
import type { Post } from "../../api/client"
import { useI18n } from "../../i18n"

interface MatchDetailsModalProps {
  post: Post
  onClose: () => void
}

export const MatchDetailsModal: React.FC<MatchDetailsModalProps> = ({
  post,
  onClose,
}) => {
  const { t } = useI18n()
  const similarPosts = post.match_reason?.similar_to_user_posts ?? []

  if (similarPosts.length === 0) return null

  const scrollToPost = (postId: string) => {
    const postElement = document.getElementById(`post-${postId}`)
    if (!postElement) {
      onClose()
      return
    }

    postElement.scrollIntoView({ behavior: "smooth", block: "center" })
    postElement.classList.add("ring-2", "ring-fuchsia-400", "ring-offset-2")
    setTimeout(() => {
      postElement.classList.remove(
        "ring-2",
        "ring-fuchsia-400",
        "ring-offset-2",
      )
    }, 2000)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <button
        type="button"
        aria-label={t("common.close")}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div className="relative z-10 bg-[#0f0f1f] rounded-lg border border-fuchsia-500/18 w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <div className="bg-[#1f1f3a] border-b border-fuchsia-500/12 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-fuchsia-900/20 border border-fuchsia-500/18 flex items-center justify-center">
              <span className="text-fuchsia-300/95 text-lg">🏷️</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-fuchsia-300/95 font-mono">
                {t("post.matchDetails")}
              </h3>
              <p className="text-xs text-fuchsia-400/60 font-mono">
                {t("post.postsContributed", { count: similarPosts.length })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-fuchsia-400/70 hover:text-fuchsia-400 hover:bg-fuchsia-900/10 rounded p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3">
          {similarPosts.slice(0, 3).map((userPost, index) => (
            <button
              key={userPost.id}
              type="button"
              className="w-full text-left p-4 bg-fuchsia-900/20 rounded-lg border border-fuchsia-500/12 hover:border-fuchsia-500/40 transition-colors cursor-pointer"
              onClick={() => scrollToPost(userPost.id)}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-fuchsia-400/80 to-cyan-400/80 flex items-center justify-center text-black text-xs font-bold border border-fuchsia-500/18 font-mono">
                    {index + 1}
                  </div>
                  <span className="text-xs font-semibold text-fuchsia-300/95 font-mono">
                    {t("post.yourPost")}
                  </span>
                </div>
              </div>
              <p className="text-sm text-cyan-300/90 leading-relaxed break-words">
                {userPost.text}
              </p>
              <p className="text-xs text-fuchsia-300/95 mt-2 font-medium font-mono">
                {t("post.clickToView")} →
              </p>
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-fuchsia-500/15 bg-[#1f1f3a]">
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
