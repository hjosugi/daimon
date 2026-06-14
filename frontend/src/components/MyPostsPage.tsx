import { useQuery } from "@tanstack/react-query"
import { FileText, Loader2 } from "lucide-react"
import type React from "react"
import { getUserPosts, type User } from "../api/client"
import { PostCard } from "./PostCard"

interface MyPostsPageProps {
  user: User | null
  onTagClick?: (tag: string) => void
  onUserClick?: (userId: string) => void
}

export const MyPostsPage: React.FC<MyPostsPageProps> = ({ user, onTagClick, onUserClick }) => {
  const {
    data: posts = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["my-posts", user?.id],
    queryFn: () => getUserPosts(user!.id),
    enabled: !!user,
    staleTime: 1000 * 30,
  })

  return (
    <div className="min-h-screen bg-[#151520]">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-4 space-y-2">
        <div className="bg-[#1f1f35] border border-cyan-500/15 rounded p-3">
          <div className="flex items-center gap-2 text-cyan-200 font-mono text-sm">
            <FileText size={16} className="text-cyan-300" />
            <span>あなたの投稿</span>
            {user && <span className="text-cyan-300/70">（{posts.length}）</span>}
          </div>
        </div>

        {!user ? (
          <div className="text-center py-16 text-cyan-300/70 font-mono text-sm">
            ログインすると自分の投稿が見られます
          </div>
        ) : isLoading ? (
          <div className="flex justify-center p-12 text-cyan-300">
            <Loader2 size={32} className="animate-spin" />
          </div>
        ) : isError ? (
          <div className="text-center py-12 text-red-300 font-mono">読み込みに失敗しました</div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 text-cyan-300/70 font-mono text-sm">
            まだ投稿がありません
          </div>
        ) : (
          <div className="space-y-2">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onTagClick={onTagClick} onUserClick={onUserClick} currentUser={user} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
