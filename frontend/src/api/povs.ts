import { api } from "./http"
import type { POVComment, POVCommentStance, POVSuggestion } from "./types"

const povPath = (pov: string) => `posts/povs/${encodeURIComponent(pov)}`

export const suggestPOVs = async (query: string): Promise<string[]> => {
  const response = await api
    .get("posts/povs/suggest", { searchParams: { query } })
    .json<POVSuggestion>()
  return response.povs
}

export const likePOV = async (
  pov: string,
): Promise<{ liked: boolean; likes: number }> => {
  return await api
    .post(`${povPath(pov)}/like`)
    .json<{ liked: boolean; likes: number }>()
}

export const unlikePOV = async (
  pov: string,
): Promise<{ liked: boolean; likes: number }> => {
  return await api
    .delete(`${povPath(pov)}/like`)
    .json<{ liked: boolean; likes: number }>()
}

export const getPOVLikeStatus = async (
  pov: string,
): Promise<{ liked: boolean; likes: number }> => {
  return await api
    .get(`${povPath(pov)}/like-status`)
    .json<{ liked: boolean; likes: number }>()
}

export const getPOVComments = async (pov: string): Promise<POVComment[]> => {
  return await api.get(`${povPath(pov)}/comments`).json<POVComment[]>()
}

export const addPOVComment = async (
  pov: string,
  text: string,
  stance: POVCommentStance,
): Promise<POVComment> => {
  return await api
    .post(`${povPath(pov)}/comments`, { json: { text, stance } })
    .json<POVComment>()
}

export const deletePOVComment = async (
  pov: string,
  commentId: string,
): Promise<{ deleted: boolean }> => {
  return await api
    .delete(`${povPath(pov)}/comments/${commentId}`)
    .json<{ deleted: boolean }>()
}
