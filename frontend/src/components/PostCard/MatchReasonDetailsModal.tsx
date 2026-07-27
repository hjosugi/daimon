import { Compass, Link2, Tags } from "lucide-react"
import type { Post } from "../../api/client"
import { useI18n } from "../../i18n"
import { formatMatchReason } from "../../utils/matchReason"
import { ModalFrame } from "../ui/ModalFrame"

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

  const explanation =
    formatMatchReason(matchReason, t) ?? t("post.reason.newPerspective")
  const matchPercent = Math.round((matchReason.pov_match_rate ?? 0) * 100)
  const senseDistance =
    matchReason.sense_distance === undefined
      ? null
      : Math.round(matchReason.sense_distance * 100)
  const similarPosts = matchReason.similar_to_user_posts ?? []

  return (
    <ModalFrame title={t("post.whyMatched")} onClose={onClose}>
      <div className="match-reason-content">
        <section className="match-reason-summary">
          <Compass size={20} aria-hidden="true" />
          <div>
            <p>{explanation}</p>
            <span>{t("post.matchReasonDetails")}</span>
          </div>
        </section>

        <div className="match-reason-metrics">
          <div>
            <strong>{matchPercent}%</strong>
            <span>{t("post.matchMetric")}</span>
          </div>
          {senseDistance !== null && (
            <div>
              <strong>{senseDistance}%</strong>
              <span>{t("post.senseDistance")}</span>
            </div>
          )}
        </div>

        {matchReason.common_povs.length > 0 && (
          <section className="match-reason-section">
            <h3>
              <Tags size={16} aria-hidden="true" />
              {t("post.commonPovs")}
            </h3>
            <div className="match-reason-tags">
              {matchReason.common_povs.map((pov) => (
                <span key={pov}>#{pov}</span>
              ))}
            </div>
          </section>
        )}

        {similarPosts.length > 0 && (
          <section className="match-reason-section">
            <h3>
              <Link2 size={16} aria-hidden="true" />
              {t("post.yourPostsContributed")}
            </h3>
            <div className="match-reason-posts">
              {similarPosts.map((userPost) => (
                <p key={userPost.id}>{userPost.text}</p>
              ))}
            </div>
          </section>
        )}
      </div>
    </ModalFrame>
  )
}
