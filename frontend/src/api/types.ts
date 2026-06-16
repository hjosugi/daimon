export interface SimilarUserPost {
  id: string
  text: string
  similarity_score?: number
}

export interface MatchReason {
  pov_matches: string[]
  common_povs: string[]
  pov_match_rate?: number
  matched_by: "tag" | "both"
  similar_to_user_posts?: SimilarUserPost[]
  reason?: string
  sense_distance?: number
  is_bridge?: boolean
}

export interface Post {
  id: string
  text: string
  povs: string[]
  user_id?: string
  username?: string
  score?: number
  likes?: number
  liked?: boolean
  saved?: boolean
  pov_stats?: Record<string, { liked: boolean; likes: number }>
  comments?: Comment[]
  commentCount?: number
  match_reason?: MatchReason
  created_at?: string
}

export interface Comment {
  id: string
  text: string
  authorId: string
  username?: string
  createdAt?: string
}

export interface POVSuggestion {
  povs: string[]
}

export type POVCommentStance = "support" | "question" | "oppose" | "note"

export interface POVComment {
  id: string
  pov: string
  text: string
  stance: POVCommentStance
  user_id: string
  username: string
  avatar_url?: string | null
  created_at: string
  mine: boolean
}

export interface User {
  id: string
  username: string
  email: string
  avatar_url?: string
  bio?: string | null
  token?: string
}

export interface RegisterData {
  username: string
  email: string
  password: string
  bio?: string
}

export interface LoginData {
  email_or_username: string
  password: string
}

export interface SearchParams {
  query?: string
  tags?: string[]
  limit?: number
}

export interface UserProfile {
  id: string
  username: string
  avatar_url?: string | null
  bio?: string | null
  posts_count: number
  followers: number
  following: number
  is_following: boolean
  is_me: boolean
}

export interface FollowUser {
  id: string
  username: string
  avatar_url?: string | null
  bio?: string | null
}
