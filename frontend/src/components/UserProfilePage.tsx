import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Loader2, UserCheck, UserPlus } from "lucide-react"
import type React from "react"
import {
  followUser,
  getUserPosts,
  getUserProfile,
  unfollowUser,
  type User,
  type UserProfile,
} from "../api/client"
import { PostCard } from "./PostCard"

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
  const qc = useQueryClient()
  const profileKey = ["profile", userId]

  const { data: profile } = useQuery({
    queryKey: profileKey,
    queryFn: () => getUserProfile(userId),
  })
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["user-posts", userId],
    queryFn: () => getUserPosts(userId),
    staleTime: 1000 * 30,
  })

  const followMutation = useMutation({
    mutationFn: () => (profile?.is_following ? unfollowUser(userId) : followUser(userId)),
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
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(profileKey, ctx.prev),
    onSuccess: (data) =>
      qc.setQueryData<UserProfile>(profileKey, (old) =>
        old ? { ...old, is_following: data.following, followers: data.followers } : old,
      ),
  })

  return (
    <div className="min-h-screen bg-[#151520]">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-4 space-y-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-cyan-300/80 hover:text-cyan-200 font-mono transition-colors"
        >
          <ArrowLeft size={16} /> 戻る
        </button>

        {profile && (
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
                <div className="text-cyan-200 font-bold font-mono truncate">@{profile.username}</div>
                <div className="mt-1 flex gap-3 text-xs font-mono text-cyan-300/75">
                  <span>投稿 {profile.posts_count}</span>
                  <span>フォロワー {profile.followers}</span>
                  <span>フォロー中 {profile.following}</span>
                </div>
              </div>
              {currentUser && !profile.is_me && (
                <button
                  onClick={() => followMutation.mutate()}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-mono font-semibold transition-all active:scale-95 ${
                    profile.is_following
                      ? "bg-[#2a2a50] text-cyan-300 border border-cyan-500/30 hover:border-red-500/40 hover:text-red-300"
                      : "bg-gradient-to-r from-cyan-500/95 to-fuchsia-500/95 text-black hover:from-cyan-400 hover:to-fuchsia-400"
                  }`}
                >
                  {profile.is_following ? <UserCheck size={15} /> : <UserPlus size={15} />}
                  {profile.is_following ? "フォロー中" : "フォロー"}
                </button>
              )}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center p-12 text-cyan-300">
            <Loader2 size={32} className="animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 text-cyan-300/70 font-mono text-sm">まだ投稿がありません</div>
        ) : (
          <div className="space-y-2">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onTagClick={onTagClick} onUserClick={onUserClick} currentUser={currentUser} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
