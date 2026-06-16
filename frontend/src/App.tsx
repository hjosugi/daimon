import { useQueryClient } from "@tanstack/react-query"
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react"
import { getCurrentUser, logout, type User } from "./api/client"
import { Header } from "./components/Header"
import { TimelinePage } from "./components/TimelinePage"
import { useI18n } from "./i18n"

const SearchPage = lazy(() =>
  import("./components/SearchPage").then((m) => ({ default: m.SearchPage })),
)
const MyPostsPage = lazy(() =>
  import("./components/MyPostsPage").then((m) => ({ default: m.MyPostsPage })),
)
const SavedPage = lazy(() =>
  import("./components/SavedPage").then((m) => ({ default: m.SavedPage })),
)
const POVDiscussionPage = lazy(() =>
  import("./components/POVDiscussionPage").then((m) => ({
    default: m.POVDiscussionPage,
  })),
)
const UserProfilePage = lazy(() =>
  import("./components/UserProfilePage").then((m) => ({
    default: m.UserProfilePage,
  })),
)
const AuthModal = lazy(() =>
  import("./components/AuthModal").then((m) => ({ default: m.AuthModal })),
)
const ProfileModal = lazy(() =>
  import("./components/ProfileModal").then((m) => ({
    default: m.ProfileModal,
  })),
)
const SettingsModal = lazy(() =>
  import("./components/SettingsModal").then((m) => ({
    default: m.SettingsModal,
  })),
)

const RouteFallback = () => {
  const { t } = useI18n()
  return (
    <main className="max-w-3xl mx-auto px-3 sm:px-4 py-8 text-center text-cyan-300/70 font-mono">
      {t("app.loading")}
    </main>
  )
}

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
    "timeline" | "search" | "mine" | "saved" | "user" | "pov"
  >("timeline")
  const [initialSearchTags, setInitialSearchTags] = useState<string[]>([])
  const [viewingUserId, setViewingUserId] = useState<string | null>(null)
  const [viewingPOV, setViewingPOV] = useState<string | null>(null)
  const [prevPage, setPrevPage] = useState<
    "timeline" | "search" | "mine" | "saved" | "pov"
  >("timeline")
  const timelineScrollRef = useRef<number>(0)

  const handleUserClick = useCallback(
    (userId: string) => {
      if (!userId) return
      setPrevPage(
        currentPage === "user"
          ? prevPage
          : (currentPage as "timeline" | "search" | "mine" | "saved" | "pov"),
      )
      setViewingUserId(userId)
      setCurrentPage("user")
    },
    [currentPage, prevPage],
  )

  const queryClient = useQueryClient()
  const openAuthModal = useCallback(() => setShowAuthModal(true), [])
  const openProfileModal = useCallback(() => setShowProfileModal(true), [])
  const openSettingsModal = useCallback(() => setShowSettingsModal(true), [])

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

  const handleLogout = useCallback(() => {
    logout()
    setUser(null)
  }, [])

  const handleTagClick = useCallback(
    (tag: string) => {
      // Save timeline scroll position
      timelineScrollRef.current = window.scrollY
      setPrevPage(
        currentPage === "pov"
          ? prevPage
          : (currentPage as "timeline" | "search" | "mine" | "saved" | "pov"),
      )
      setViewingPOV(tag)
      setCurrentPage("pov")
    },
    [currentPage, prevPage],
  )

  const handleBackToTimeline = useCallback(() => {
    setCurrentPage("timeline")
    // Restore scroll position after a short delay to ensure DOM is ready
    setTimeout(() => {
      window.scrollTo({ top: timelineScrollRef.current, behavior: "smooth" })
    }, 100)
  }, [])

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
        onAuthClick={openAuthModal}
        onProfileClick={openProfileModal}
        onLogout={handleLogout}
        onSettingsClick={openSettingsModal}
        similarityWeight={similarityWeight}
      />

      <Suspense fallback={<RouteFallback />}>
        {currentPage === "search" ? (
          <SearchPage
            initialTags={initialSearchTags}
            onTagsChange={setInitialSearchTags}
            onBack={handleBackToTimeline}
            onUserClick={handleUserClick}
            currentUser={user}
          />
        ) : currentPage === "mine" ? (
          <MyPostsPage
            user={user}
            onTagClick={handleTagClick}
            onUserClick={handleUserClick}
          />
        ) : currentPage === "saved" ? (
          <SavedPage user={user} onTagClick={handleTagClick} />
        ) : currentPage === "pov" && viewingPOV ? (
          <POVDiscussionPage
            pov={viewingPOV}
            user={user}
            onBack={() =>
              setCurrentPage(prevPage === "pov" ? "timeline" : prevPage)
            }
            onAuthRequired={openAuthModal}
            onTagClick={handleTagClick}
            onUserClick={handleUserClick}
          />
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
            onAuthRequired={openAuthModal}
            onTagClick={handleTagClick}
            onUserClick={handleUserClick}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {/* Auth Modal */}
        {showAuthModal && (
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            onSuccess={(user) => {
              setUser(user)
              setShowAuthModal(false)
            }}
          />
        )}

        {/* Profile Modal */}
        {user && showProfileModal && (
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
        {showSettingsModal && (
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
        )}
      </Suspense>
    </div>
  )
}

export default App
