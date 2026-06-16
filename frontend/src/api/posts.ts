import { api } from "./http"
import type { Comment, POVSuggestion, Post, SearchParams } from "./types"

export const generatePOVs = async (text: string): Promise<string[]> => {
  try {
    const response = await api
      .post("posts/generate-povs", { json: { text } })
      .json<POVSuggestion>()
    return response.povs
  } catch (error) {
    console.warn("POV generation API not available, using mock POVs", error)
    return generateMockPOVs(text)
  }
}

function generateMockPOVs(text: string): string[] {
  const keywords = text
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .filter(
      (word) =>
        !["this", "that", "with", "from", "have", "been"].includes(word),
    )
    .slice(0, 5)
  return [...new Set(keywords)]
}

export const createPost = async (
  text: string,
  povs: string[] = [],
): Promise<Post> => {
  return await api.post("posts/", { json: { text, povs } }).json<Post>()
}

export const getTimeline = async (
  queryText: string,
  similarityWeight = 0.7,
  boostPopular = false,
  includeFarPosts = false,
): Promise<Post[]> => {
  return await api
    .post("posts/timeline", {
      json: {
        query_text: queryText,
        similarity_weight: similarityWeight,
        boost_popular: boostPopular,
        include_far_posts: includeFarPosts,
      },
    })
    .json<Post[]>()
}

export const searchPosts = async (params: SearchParams): Promise<Post[]> => {
  return await api
    .post("posts/search", {
      json: {
        query: params.query || null,
        povs: params.tags || null,
        limit: params.limit || 20,
      },
    })
    .json<Post[]>()
}

export const getUserPosts = async (userId: string): Promise<Post[]> => {
  return await api.get(`posts/by-user/${userId}`).json<Post[]>()
}

export const getFollowingFeed = async (): Promise<Post[]> => {
  return await api.get("posts/following").json<Post[]>()
}

export const likePost = async (
  postId: string,
): Promise<{ liked: boolean; likes: number }> => {
  return await api
    .post(`posts/${postId}/like`)
    .json<{ liked: boolean; likes: number }>()
}

export const unlikePost = async (
  postId: string,
): Promise<{ liked: boolean; likes: number }> => {
  return await api
    .delete(`posts/${postId}/like`)
    .json<{ liked: boolean; likes: number }>()
}

export const getComments = async (postId: string): Promise<Comment[]> => {
  return await api.get(`posts/${postId}/comments`).json<Comment[]>()
}

export const addComment = async (
  postId: string,
  text: string,
): Promise<Comment> => {
  return await api
    .post(`posts/${postId}/comments`, { json: { text } })
    .json<Comment>()
}

export const deletePost = async (postId: string): Promise<void> => {
  await api.delete(`posts/${postId}`).json()
}
