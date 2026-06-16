import { api } from "./http"
import type { Post } from "./types"

export const savePost = async (postId: string): Promise<{ saved: boolean }> => {
  return await api.post(`posts/${postId}/save`).json()
}

export const unsavePost = async (
  postId: string,
): Promise<{ saved: boolean }> => {
  return await api.delete(`posts/${postId}/save`).json()
}

export const getSaveStatus = async (
  postId: string,
): Promise<{ saved: boolean }> => {
  return await api.get(`posts/${postId}/save-status`).json()
}

export const getSavedPosts = async (): Promise<Post[]> => {
  return await api.get("posts/saved").json<Post[]>()
}
