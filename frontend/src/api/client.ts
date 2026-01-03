import ky from "ky"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"

// Get token from localStorage
const getToken = () => {
  return localStorage.getItem("auth_token")
}

export const api = ky.create({
  prefixUrl: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  hooks: {
    beforeRequest: [
      (request) => {
        const token = getToken()
        if (token) {
          request.headers.set("Authorization", `Bearer ${token}`)
        }
      },
    ],
  },
})

export interface SimilarUserPost {
  id: string
  text: string
  similarity_score?: number
}

export interface MatchReason {
  pov_matches: string[]  // POVs that matched (from search query or user's posts)
  common_povs: string[]  // POVs in common with user's posts
  pov_match_rate?: number  // POV match rate (0.0 to 1.0)
  matched_by: "tag" | "both"  // Match type (TAG or BOTH)
  similar_to_user_posts?: SimilarUserPost[]  // User's posts that contributed to the POV match (max 3)
}

export interface Post {
  id: string
  text: string
  povs: string[]  // POVs (Points of View) for this post
  user_id?: string  // User who created this post
  username?: string  // Username of the post author
  score?: number
  likes?: number
  liked?: boolean
  comments?: Comment[]
  commentCount?: number
  match_reason?: MatchReason
  created_at?: string  // ISO format timestamp
}

export interface Comment {
  id: string
  text: string
  authorId: string
  username?: string  // Username of the comment author
  createdAt?: string
}

export interface POVSuggestion {
  povs: string[]
}

export const generatePOVs = async (text: string): Promise<string[]> => {
  try {
    const response = await api
      .post("posts/generate-povs", { json: { text } })
      .json<POVSuggestion>()
    return response.povs
  } catch (error) {
    // Fallback to mock POVs if API is not available
    console.warn("POV generation API not available, using mock POVs", error)
    return generateMockPOVs(text)
  }
}

// Mock POV generation (simple keyword extraction)
function generateMockPOVs(text: string): string[] {
  const keywords = text
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .filter((word) => !["this", "that", "with", "from", "have", "been"].includes(word))
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

export const likePost = async (postId: string): Promise<{ liked: boolean; likes: number }> => {
  return await api.post(`posts/${postId}/like`).json<{ liked: boolean; likes: number }>()
}

export const unlikePost = async (postId: string): Promise<{ liked: boolean; likes: number }> => {
  return await api.delete(`posts/${postId}/like`).json<{ liked: boolean; likes: number }>()
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

// Auth APIs
export interface User {
  id: string
  username: string
  email: string
  avatar_url?: string
  token?: string
}

export interface RegisterData {
  username: string
  email: string
  password: string
}

export interface LoginData {
  email_or_username: string
  password: string
}

export const register = async (data: RegisterData): Promise<User> => {
  try {
    const response = await api.post("auth/register", { json: data }).json<User>()
    if (response.token) {
      localStorage.setItem("auth_token", response.token)
      localStorage.setItem("user_id", response.id)
    }
    return response
  } catch (error: any) {
    // Re-throw with error details for better error handling
    if (error.response) {
      const errorData = await error.response.json()
      throw new Error(errorData.detail || "登録に失敗しました")
    }
    throw error
  }
}

export const login = async (data: LoginData): Promise<User> => {
  try {
    const response = await api.post("auth/login", { json: data }).json<User>()
    if (response.token) {
      localStorage.setItem("auth_token", response.token)
      localStorage.setItem("user_id", response.id)
    }
    return response
  } catch (error: any) {
    // Re-throw with error details for better error handling
    if (error.response) {
      const errorData = await error.response.json()
      throw new Error(errorData.detail || "ログインに失敗しました")
    }
    throw error
  }
}

export const logout = () => {
  localStorage.removeItem("auth_token")
  localStorage.removeItem("user_id")
}

export const getCurrentUser = async (): Promise<User> => {
  return await api.get("auth/me").json<User>()
}

export const updateProfile = async (data: {
  username?: string
  avatar_url?: string
}): Promise<User> => {
  return await api.put("auth/profile", { json: data }).json<User>()
}

export const deleteAccount = async (): Promise<void> => {
  await api.delete("auth/account").json()
  // Clear local storage
  localStorage.removeItem("auth_token")
  localStorage.removeItem("user_id")
}

// POV suggestions
export const suggestPOVs = async (query: string): Promise<string[]> => {
  const response = await api
    .get("posts/povs/suggest", { searchParams: { query } })
    .json<POVSuggestion>()
  return response.povs
}

// Search APIs
export interface SearchParams {
  query?: string
  tags?: string[]  // Keep for backward compatibility, but will be mapped to povs
  limit?: number
}

export const searchPosts = async (params: SearchParams): Promise<Post[]> => {
  return await api
    .post("posts/search", {
      json: {
        query: params.query || null,
        povs: params.tags || null,  // Keep tags parameter name for backward compatibility, but map to povs
        limit: params.limit || 20,
      },
    })
    .json<Post[]>()
}

// POV Like APIs
export const likePOV = async (pov: string): Promise<{ liked: boolean; likes: number }> => {
  return await api.post(`posts/povs/${encodeURIComponent(pov)}/like`).json<{ liked: boolean; likes: number }>()
}

export const unlikePOV = async (pov: string): Promise<{ liked: boolean; likes: number }> => {
  return await api.delete(`posts/povs/${encodeURIComponent(pov)}/like`).json<{ liked: boolean; likes: number }>()
}

export const getPOVLikeStatus = async (pov: string): Promise<{ liked: boolean; likes: number }> => {
  return await api.get(`posts/povs/${encodeURIComponent(pov)}/like-status`).json<{ liked: boolean; likes: number }>()
}
