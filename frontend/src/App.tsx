import { useState, useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { getCurrentUser, logout, type User } from "./api/client"
import { Header } from "./components/Header"
import { TimelinePage } from "./components/TimelinePage"
import { SearchPage } from "./components/SearchPage"
import { MyPostsPage } from "./components/MyPostsPage"
import { SavedPage } from "./components/SavedPage"
import { UserProfilePage } from "./components/UserProfilePage"
import { AuthModal } from "./components/AuthModal"
import { ProfileModal } from "./components/ProfileModal"
import { SettingsModal } from "./components/SettingsModal"

function App() {
  const [similarityWeight, setSimilarityWeight] = useState<number>(0.7)
  const [boostPopular, setBoostPopular] = useState<boolean>(true)
  const [includeFarPosts, setIncludeFarPosts] = useState<boolean>(false)

  // Auth state
  const [user, setUser] = useState<User | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)

  // Page state
  const [currentPage, setCurrentPage] = useState<
    "timeline" | "search" | "mine" | "saved" | "user"
  >("timeline")
  const [initialSearchTags, setInitialSearchTags] = useState<string[]>([])
  const [viewingUserId, setViewingUserId] = useState<string | null>(null)
  const [prevPage, setPrevPage] = useState<"timeline" | "search" | "mine" | "saved">("timeline")
  const timelineScrollRef = useRef<number>(0)

  const handleUserClick = (userId: string) => {
    if (!userId) return
    setPrevPage(currentPage === "user" ? prevPage : (currentPage as "timeline" | "search" | "mine" | "saved"))
    setViewingUserId(userId)
    setCurrentPage("user")
  }

  const queryClient = useQueryClient()

  // Check if user is logged in
  useEffect(() => {
    const token = localStorage.getItem("auth_token")
    if (token) {
      getCurrentUser()
        .then(setUser)
        .catch(() => {
          localStorage.removeItem("auth_token")
          localStorage.removeItem("user_id")
        })
    }
  }, [])

  const handleLogout = () => {
    logout()
    setUser(null)
  }

  const handleTagClick = (tag: string) => {
    // Save timeline scroll position
    timelineScrollRef.current = window.scrollY
    setInitialSearchTags([tag])
    setCurrentPage("search")
  }

  const handleBackToTimeline = () => {
    setCurrentPage("timeline")
    // Restore scroll position after a short delay to ensure DOM is ready
    setTimeout(() => {
      window.scrollTo({ top: timelineScrollRef.current, behavior: "smooth" })
    }, 100)
  }

  return (
    <div className="min-h-screen bg-[#151520] text-cyan-200 font-mono relative overflow-x-hidden">
      {/* Scanline effect */}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-5">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500 to-transparent h-[2px] animate-[scanline_8s_linear_infinite]"></div>
      </div>
      <Header
        user={user}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onAuthClick={() => setShowAuthModal(true)}
        onProfileClick={() => setShowProfileModal(true)}
        onLogout={handleLogout}
        onSettingsClick={() => setShowSettingsModal(true)}
        similarityWeight={similarityWeight}
      />

      {currentPage === "search" ? (
        <SearchPage
          initialTags={initialSearchTags}
          onTagsChange={setInitialSearchTags}
          onBack={handleBackToTimeline}
          onUserClick={handleUserClick}
        />
      ) : currentPage === "mine" ? (
        <MyPostsPage user={user} onTagClick={handleTagClick} onUserClick={handleUserClick} />
      ) : currentPage === "saved" ? (
        <SavedPage user={user} onTagClick={handleTagClick} />
      ) : currentPage === "user" && viewingUserId ? (
        <UserProfilePage
          userId={viewingUserId}
          currentUser={user}
          onBack={() => setCurrentPage(prevPage)}
          onTagClick={handleTagClick}
          onUserClick={handleUserClick}
        />
      ) : (
        <TimelinePage
          user={user}
          queryText="General interest"
          similarityWeight={similarityWeight}
          boostPopular={boostPopular}
          includeFarPosts={includeFarPosts}
          onAuthRequired={() => setShowAuthModal(true)}
          onTagClick={handleTagClick}
          onUserClick={handleUserClick}
        />
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={(user) => {
          setUser(user)
          setShowAuthModal(false)
        }}
      />

      {/* Profile Modal */}
      {user && (
        <ProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          onSuccess={(updatedUser) => {
            setUser(updatedUser)
            setShowProfileModal(false)
            queryClient.invalidateQueries({ queryKey: ["timeline"] })
          }}
          onDelete={() => {
            setUser(null)
            setShowProfileModal(false)
          }}
          currentUser={user}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        similarityWeight={similarityWeight}
        onSimilarityWeightChange={setSimilarityWeight}
        boostPopular={boostPopular}
        onBoostPopularChange={setBoostPopular}
        includeFarPosts={includeFarPosts}
        onIncludeFarPostsChange={setIncludeFarPosts}
      />
    </div>
  )
}

export default App
