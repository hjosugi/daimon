import type React from "react"
import { Settings2, User as UserIcon, LogOut, Search, Home } from "lucide-react"
import type { User } from "../api/client"

interface HeaderProps {
  user: User | null
  currentPage: "timeline" | "search"
  onPageChange: (page: "timeline" | "search") => void
  onAuthClick: () => void
  onProfileClick: () => void
  onLogout: () => void
  onSettingsClick: () => void
  similarityWeight: number
}

export const Header: React.FC<HeaderProps> = ({
  user,
  currentPage,
  onPageChange,
  onAuthClick,
  onProfileClick,
  onLogout,
  onSettingsClick,
  similarityWeight,
}) => {
  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200/50 sticky top-0 z-10 shadow-sm">
      <div className="max-w-2xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between">
        <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-1 sm:gap-2">
          Daimon
        </h1>
        <div className="flex items-center gap-1 sm:gap-3">
          {/* Navigation */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => onPageChange("timeline")}
              className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md transition-all text-xs sm:text-sm font-medium ${
                currentPage === "timeline"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Home size={14} className="sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Home</span>
            </button>
            <button
              onClick={() => onPageChange("search")}
              className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md transition-all text-xs sm:text-sm font-medium ${
                currentPage === "search"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Search size={14} className="sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Search</span>
            </button>
          </div>
          <button
            onClick={onSettingsClick}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-purple-50 to-blue-50 hover:from-purple-100 hover:to-blue-100 rounded-full transition-all text-xs sm:text-sm text-slate-700 hover:text-slate-900"
            title="Timeline Settings"
          >
            <Settings2 size={14} className="sm:w-4 sm:h-4 text-purple-600" />
            <span className="hidden sm:inline font-medium">Sense: </span>
            <span className="text-xs sm:text-sm font-medium">{Math.round(similarityWeight * 100)}%</span>
          </button>
          {user ? (
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={onProfileClick}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-blue-50 to-purple-50 rounded-full hover:from-blue-100 hover:to-purple-100 transition-all cursor-pointer"
                title="Edit Profile"
              >
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.username}
                    className="w-5 h-5 sm:w-6 sm:h-6 rounded-full"
                  />
                ) : (
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-white text-xs font-bold">
                    {user.username[0].toUpperCase()}
                  </div>
                )}
                <span className="hidden sm:inline text-sm font-medium text-slate-700">{user.username}</span>
              </button>
              <button
                onClick={onLogout}
                className="p-1.5 sm:p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut size={16} className="sm:w-[18px] sm:h-[18px]" />
              </button>
            </div>
          ) : (
            <button
              onClick={onAuthClick}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full hover:from-blue-600 hover:to-purple-600 transition-all shadow-md hover:shadow-lg text-xs sm:text-sm font-medium"
            >
              <UserIcon size={14} className="sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Login</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
