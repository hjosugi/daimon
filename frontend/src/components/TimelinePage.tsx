import { Loader2, Pencil } from "lucide-react"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getTimeline } from "../api/client"
import { PostCard } from "./PostCard"
import { PostInputForm } from "./PostInputForm"
import type { User } from "../api/client"

interface TimelinePageProps {
  user: User | null
  queryText: string
  similarityWeight: number
  boostPopular: boolean
  includeFarPosts: boolean
  onAuthRequired: () => void
  onTagClick: (tag: string) => void
}

export const TimelinePage: React.FC<TimelinePageProps> = ({
  user,
  queryText,
  similarityWeight,
  boostPopular,
  includeFarPosts,
  onAuthRequired,
  onTagClick,
}) => {
  const [showPostForm, setShowPostForm] = useState(false)
  const { data: posts = [], isLoading, isError } = useQuery({
    queryKey: ["timeline", similarityWeight, queryText, boostPopular, includeFarPosts],
    queryFn: () =>
      getTimeline(queryText || "General interest", similarityWeight, boostPopular, includeFarPosts),
    staleTime: 1000 * 60 * 1,
  })

  return (
    <main className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 relative">
      {showPostForm && (
        <PostInputForm 
          user={user} 
          onAuthRequired={onAuthRequired}
          onPostCreated={() => setShowPostForm(false)}
        />
      )}

      {/* Timeline */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center p-8 text-cyan-300/90">
            <Loader2 size={32} className="animate-spin" />
          </div>
        ) : isError ? (
          <div className="text-center py-12 text-red-400/70">
            <p className="font-mono">[ERROR] FAILED TO LOAD</p>
          </div>
        ) : (
          <>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onTagClick={onTagClick} currentUser={user} />
            ))}
            {posts.length === 0 && (
              <div className="text-center py-12 text-cyan-300/70">
                <p className="font-mono">NO POSTS YET. START A CONVERSATION!</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating Action Button - Pencil */}
      <button
        onClick={() => {
          if (!user) {
            onAuthRequired()
            return
          }
          setShowPostForm(!showPostForm)
        }}
        className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-r from-cyan-500/90 to-fuchsia-500/90 text-black rounded-full hover:from-cyan-400 hover:to-fuchsia-400 transition-all flex items-center justify-center z-40 font-mono font-bold"
        title="Create post"
      >
        <Pencil size={24} className="sm:w-6 sm:h-6" />
      </button>
    </main>
  )
}
