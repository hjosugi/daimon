import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  UserCheck,
  UserPlus,
  X,
} from "lucide-react"
import type React from "react"
import {
  type FollowUser,
  followUser,
  getFollowers,
  getUserPosts,
  getUserProfile,
  removeFollower,
  type User,
  type UserProfile,
  unfollowUser,
} from "../api/client"
import { useI18n } from "../i18n"
import { PostCard } from "./PostCard"
import { QueryStateView } from "./ui/QueryStateView"

interface UserProfilePageProps {
  userId: string
  currentUser: User | null
  onBack: () => void
  onTagClick?: (tag: string) => void
  onUserClick?: (userId: string) => void
}

export const UserProfilePage: React.FC<UserProfilePageProps> = ({
  userId,
  currentUser,
  onBack,
  onTagClick,
  onUserClick,
}) => {
  const { t } = useI18n()
  const qc = useQueryClient()
  const profileKey = ["profile", userId]

  const {
    data: profile,
    isLoading: isProfileLoading,
    isError: isProfileError,
    isFetching: isProfileFetching,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: profileKey,
    queryFn: () => getUserProfile(userId),
  })
  const {
    data: posts = [],
    isLoading: isPostsLoading,
    isError: isPostsError,
  } = useQuery({
    queryKey: ["user-posts", userId],
    queryFn: () => getUserPosts(userId),
    staleTime: 1000 * 30,
  })
  const { data: followers = [] } = useQuery({
    queryKey: ["followers", userId],
    queryFn: () => getFollowers(userId),
    enabled: !!profile?.is_me,
    staleTime: 1000 * 30,
  })

  const followMutation = useMutation({
    mutationFn: () =>
      profile?.is_following ? unfollowUser(userId) : followUser(userId),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: profileKey })
      const prev = qc.getQueryData<UserProfile>(profileKey)
      qc.setQueryData<UserProfile>(profileKey, (old) =>
        old
          ? {
              ...old,
              is_following: !old.is_following,
              followers: old.followers + (old.is_following ? -1 : 1),
            }
          : old,
      )
      return { prev }
    },
    onError: (_e, _v, ctx) =>
      ctx?.prev && qc.setQueryData(profileKey, ctx.prev),
    onSuccess: (data) =>
      qc.setQueryData<UserProfile>(profileKey, (old) =>
        old
          ? { ...old, is_following: data.following, followers: data.followers }
          : old,
      ),
  })

  const removeFollowerMutation = useMutation({
    mutationFn: (followerId: string) => removeFollower(followerId),
    onMutate: async (followerId) => {
      await qc.cancelQueries({ queryKey: ["followers", userId] })
      const prevFollowers = qc.getQueryData<FollowUser[]>(["followers", userId])
      const prevProfile = qc.getQueryData<UserProfile>(profileKey)
      qc.setQueryData<FollowUser[]>(["followers", userId], (old) =>
        old ? old.filter((f) => f.id !== followerId) : old,
      )
      qc.setQueryData<UserProfile>(profileKey, (old) =>
        old ? { ...old, followers: Math.max(0, old.followers - 1) } : old,
      )
      return { prevFollowers, prevProfile }
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prevFollowers)
        qc.setQueryData(["followers", userId], ctx.prevFollowers)
      if (ctx?.prevProfile) qc.setQueryData(profileKey, ctx.prevProfile)
    },
    onSuccess: (data) =>
      qc.setQueryData<UserProfile>(profileKey, (old) =>
        old ? { ...old, followers: data.followers } : old,
      ),
  })

  return (
    <div className="min-h-screen bg-[#151520]">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-4 space-y-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-cyan-300/80 hover:text-cyan-200 font-mono transition-colors"
        >
          <ArrowLeft size={16} /> {t("common.back")}
        </button>

        {isProfileLoading ? (
          <div className="bg-[#1f1f35] border border-cyan-500/15 rounded p-4">
            <div className="flex items-center gap-3 text-cyan-300 font-mono text-sm">
              <Loader2 size={18} className="animate-spin" />
              {t("user.profileLoading")}
            </div>
          </div>
        ) : isProfileError ? (
          <div className="bg-[#1f1f35] border border-red-500/25 rounded p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-red-200 font-mono">
                {t("user.profileLoadError")}
              </p>
              <button
                type="button"
                onClick={() => void refetchProfile()}
                disabled={isProfileFetching}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded border border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-mono transition-colors"
              >
                {isProfileFetching ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                {t("common.retry")}
              </button>
            </div>
          </div>
        ) : profile ? (
          <div className="bg-[#1f1f35] border border-cyan-500/15 rounded p-4">
            <div className="flex items-center gap-3">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.username}
                  className="w-12 h-12 rounded-full border border-cyan-500/20"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400/90 to-fuchsia-400/90 flex items-center justify-center text-black font-bold border border-cyan-500/20">
                  {profile.username[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-cyan-200 font-bold font-mono truncate">
                  @{profile.username}
                </div>
                <div className="mt-1 flex gap-3 text-xs font-mono text-cyan-300/75">
                  <span>{t("user.posts", { count: profile.posts_count })}</span>
                  <span>
                    {t("user.followers", { count: profile.followers })}
                  </span>
                  <span>
                    {t("user.following", { count: profile.following })}
                  </span>
                </div>
                {profile.bio && (
                  <p className="mt-2 text-sm text-cyan-200/85 leading-relaxed break-words">
                    {profile.bio}
                  </p>
                )}
              </div>
              {currentUser && !profile.is_me && (
                <button
                  type="button"
                  onClick={() => followMutation.mutate()}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-mono font-semibold transition-all active:scale-95 ${
                    profile.is_following
                      ? "bg-[#2a2a50] text-cyan-300 border border-cyan-500/30 hover:border-red-500/40 hover:text-red-300"
                      : "bg-gradient-to-r from-cyan-500/95 to-fuchsia-500/95 text-black hover:from-cyan-400 hover:to-fuchsia-400"
                  }`}
                >
                  {profile.is_following ? (
                    <UserCheck size={15} />
                  ) : (
                    <UserPlus size={15} />
                  )}
                  {profile.is_following
                    ? t("user.followingButton")
                    : t("user.follow")}
                </button>
              )}
            </div>
          </div>
        ) : null}

        {profile?.is_me && (
          <div className="bg-[#1f1f35] border border-cyan-500/15 rounded p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-cyan-200 font-mono">
                {t("user.followersTitle")}
              </h2>
              <span className="text-xs text-cyan-300/70 font-mono">
                {followers.length}
              </span>
            </div>
            {followers.length === 0 ? (
              <div className="text-xs text-cyan-300/60 font-mono">
                {t("user.noFollowers")}
              </div>
            ) : (
              <div className="space-y-2">
                {followers.map((follower) => (
                  <div
                    key={follower.id}
                    className="flex items-center gap-2 rounded border border-cyan-500/12 bg-[#151520] p-2"
                  >
                    {follower.avatar_url ? (
                      <img
                        src={follower.avatar_url}
                        alt={follower.username}
                        className="w-8 h-8 rounded-full border border-cyan-500/20"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400/90 to-fuchsia-400/90 flex items-center justify-center text-black text-xs font-bold">
                        {follower.username[0]?.toUpperCase()}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => onUserClick?.(follower.id)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="truncate text-sm text-cyan-200 font-mono">
                        @{follower.username}
                      </div>
                      {follower.bio && (
                        <div className="truncate text-xs text-cyan-300/60">
                          {follower.bio}
                        </div>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFollowerMutation.mutate(follower.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-500/25 text-red-300 hover:bg-red-900/20 hover:border-red-500/45 text-xs font-mono transition-colors"
                      title={t("user.removeFollower")}
                    >
                      <X size={12} />
                      {t("common.remove")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <QueryStateView
          isLoading={isPostsLoading}
          isError={isPostsError}
          isEmpty={posts.length === 0}
          error={t("mine.loadError")}
          empty={t("mine.empty")}
        >
          <div className="space-y-2">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onTagClick={onTagClick}
                onUserClick={onUserClick}
                currentUser={currentUser}
              />
            ))}
          </div>
        </QueryStateView>
      </div>
    </div>
  )
}
