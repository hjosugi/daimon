import { useQueryClient } from "@tanstack/react-query"
import { Pencil } from "lucide-react"
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  Navigate,
  Route,
  Routes,
  ScrollRestoration,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom"
import {
  clearAuthSession,
  getAuthToken,
  getCurrentUser,
  logout,
  type User,
} from "./api/client"
import { Header } from "./components/Header"
import { PostInputForm } from "./components/PostInputForm"
import { TimelinePage } from "./components/TimelinePage"
import { ModalFrame } from "./components/ui/ModalFrame"
import { useI18n } from "./i18n"
import type { Page } from "./types/navigation"

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

const pagePaths: Record<Exclude<Page, "user" | "pov">, string> = {
  timeline: "/",
  search: "/search",
  mine: "/mine",
  saved: "/saved",
}

const pageFromPath = (pathname: string): Page => {
  if (pathname === "/search") return "search"
  if (pathname === "/mine") return "mine"
  if (pathname === "/saved") return "saved"
  if (pathname.startsWith("/u/")) return "user"
  if (pathname.startsWith("/pov/")) return "pov"
  return "timeline"
}

const userPath = (userId: string) => `/u/${encodeURIComponent(userId)}`
const povPath = (tag: string) => `/pov/${encodeURIComponent(tag)}`

const tagsFromSearch = (search: string) =>
  new URLSearchParams(search).getAll("tag")

const sameTags = (left: string[], right: string[]) =>
  left.length === right.length &&
  left.every((tag, index) => tag === right[index])

interface UserProfileRouteProps {
  currentUser: User | null
  onBack: () => void
  onTagClick: (tag: string) => void
  onUserClick: (userId: string) => void
}

const UserProfileRoute: React.FC<UserProfileRouteProps> = ({
  currentUser,
  onBack,
  onTagClick,
  onUserClick,
}) => {
  const { userId } = useParams()
  if (!userId) return <Navigate to="/" replace />
  return (
    <UserProfilePage
      userId={userId}
      currentUser={currentUser}
      onBack={onBack}
      onTagClick={onTagClick}
      onUserClick={onUserClick}
    />
  )
}

interface POVRouteProps {
  user: User | null
  onBack: () => void
  onAuthRequired: () => void
  onTagClick: (tag: string) => void
  onUserClick: (userId: string) => void
}

const POVRoute: React.FC<POVRouteProps> = ({
  user,
  onBack,
  onAuthRequired,
  onTagClick,
  onUserClick,
}) => {
  const { tag } = useParams()
  if (!tag) return <Navigate to="/" replace />
  return (
    <POVDiscussionPage
      pov={tag}
      user={user}
      onBack={onBack}
      onAuthRequired={onAuthRequired}
      onTagClick={onTagClick}
      onUserClick={onUserClick}
    />
  )
}

function App() {
  const { t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
  const [similarityWeight, setSimilarityWeight] = useState<number>(0.7)
  const [boostPopular, setBoostPopular] = useState<boolean>(true)
  const [includeFarPosts, setIncludeFarPosts] = useState<boolean>(false)

  // Auth state
  const [user, setUser] = useState<User | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showPostComposer, setShowPostComposer] = useState(false)
  const [openComposerAfterAuth, setOpenComposerAfterAuth] = useState(false)

  const currentPage = useMemo(
    () => pageFromPath(location.pathname),
    [location.pathname],
  )
  const initialSearchTags = useMemo(
    () => tagsFromSearch(location.search),
    [location.search],
  )

  const queryClient = useQueryClient()
  const openAuthModal = useCallback(() => setShowAuthModal(true), [])
  const openProfileModal = useCallback(() => setShowProfileModal(true), [])
  const openSettingsModal = useCallback(() => setShowSettingsModal(true), [])
  const openPostComposer = useCallback(() => {
    if (!user) {
      setOpenComposerAfterAuth(true)
      setShowAuthModal(true)
      return
    }
    setShowPostComposer(true)
  }, [user])

  // Check if user is logged in
  useEffect(() => {
    const token = getAuthToken()
    if (token) {
      getCurrentUser().then(setUser).catch(clearAuthSession)
    }
  }, [])

  const handleLogout = useCallback(() => {
    logout()
    setUser(null)
    setShowPostComposer(false)
  }, [])

  const handlePageChange = useCallback(
    (page: Page) => {
      if (page === "user" && user) {
        navigate(userPath(user.id))
        return
      }
      if (page === "user" || page === "pov") {
        navigate("/")
        return
      }
      navigate(pagePaths[page])
    },
    [navigate, user],
  )

  const handleUserClick = useCallback(
    (userId: string) => {
      if (!userId) return
      navigate(userPath(userId))
    },
    [navigate],
  )

  const handleTagClick = useCallback(
    (tag: string) => {
      navigate(povPath(tag))
    },
    [navigate],
  )

  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate("/")
  }, [navigate])

  const handleSearchTagsChange = useCallback(
    (tags: string[]) => {
      if (location.pathname !== "/search") return
      const currentTags = tagsFromSearch(location.search)
      if (sameTags(currentTags, tags)) return

      const params = new URLSearchParams(location.search)
      params.delete("tag")
      for (const tag of tags) {
        params.append("tag", tag)
      }
      const search = params.toString()
      navigate(
        { pathname: "/search", search: search ? `?${search}` : "" },
        { replace: true },
      )
    },
    [location.pathname, location.search, navigate],
  )

  return (
    <div className="app-shell min-h-screen relative overflow-x-hidden">
      <Header
        user={user}
        currentPage={currentPage}
        onPageChange={handlePageChange}
        onAuthClick={openAuthModal}
        onProfileClick={openProfileModal}
        onLogout={handleLogout}
        onSettingsClick={openSettingsModal}
        similarityWeight={similarityWeight}
      />
      <ScrollRestoration />

      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route
            path="/"
            element={
              <TimelinePage
                user={user}
                queryText="General interest"
                similarityWeight={similarityWeight}
                boostPopular={boostPopular}
                includeFarPosts={includeFarPosts}
                onCompose={openPostComposer}
                onTagClick={handleTagClick}
                onUserClick={handleUserClick}
              />
            }
          />
          <Route
            path="/search"
            element={
              <SearchPage
                initialTags={initialSearchTags}
                onTagsChange={handleSearchTagsChange}
                onUserClick={handleUserClick}
                currentUser={user}
              />
            }
          />
          <Route
            path="/mine"
            element={
              <MyPostsPage
                user={user}
                onTagClick={handleTagClick}
                onUserClick={handleUserClick}
              />
            }
          />
          <Route
            path="/saved"
            element={<SavedPage user={user} onTagClick={handleTagClick} />}
          />
          <Route
            path="/pov/:tag"
            element={
              <POVRoute
                user={user}
                onBack={handleBack}
                onAuthRequired={openAuthModal}
                onTagClick={handleTagClick}
                onUserClick={handleUserClick}
              />
            }
          />
          <Route
            path="/u/:userId"
            element={
              <UserProfileRoute
                currentUser={user}
                onBack={handleBack}
                onTagClick={handleTagClick}
                onUserClick={handleUserClick}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      <button
        type="button"
        onClick={openPostComposer}
        className="compose-action compose-fab fixed bottom-6 right-6 sm:bottom-8 sm:right-8 w-14 h-14 sm:w-16 sm:h-16 rounded-full transition-all flex items-center justify-center z-40 font-mono"
        title={t("timeline.createPost")}
        aria-label={t("timeline.createPost")}
      >
        <Pencil size={24} aria-hidden="true" />
      </button>

      {showPostComposer && user && (
        <ModalFrame
          title={t("postForm.title")}
          onClose={() => setShowPostComposer(false)}
          maxWidthClassName="max-w-3xl"
        >
          <PostInputForm
            user={user}
            onAuthRequired={openAuthModal}
            onPostCreated={() => setShowPostComposer(false)}
            showHeader={false}
          />
        </ModalFrame>
      )}

      <Suspense fallback={null}>
        {/* Auth Modal */}
        {showAuthModal && (
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => {
              setShowAuthModal(false)
              setOpenComposerAfterAuth(false)
            }}
            onSuccess={(authenticatedUser) => {
              setUser(authenticatedUser)
              setShowAuthModal(false)
              if (openComposerAfterAuth) {
                setShowPostComposer(true)
                setOpenComposerAfterAuth(false)
              }
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
