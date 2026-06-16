import { api } from "./http"
import type { FollowUser, UserProfile } from "./types"

export const getUserProfile = async (userId: string): Promise<UserProfile> => {
  return await api.get(`users/${userId}`).json<UserProfile>()
}

export const getFollowers = async (userId: string): Promise<FollowUser[]> => {
  return await api.get(`users/${userId}/followers`).json<FollowUser[]>()
}

export const followUser = async (
  userId: string,
): Promise<{ following: boolean; followers: number }> => {
  return await api.post(`users/${userId}/follow`).json()
}

export const unfollowUser = async (
  userId: string,
): Promise<{ following: boolean; followers: number }> => {
  return await api.delete(`users/${userId}/follow`).json()
}

export const removeFollower = async (
  userId: string,
): Promise<{ removed: boolean; followers: number }> => {
  return await api.delete(`users/${userId}/follower`).json()
}
