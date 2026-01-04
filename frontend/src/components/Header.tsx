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
    <header className="bg-[#151520]/95 backdrop-blur-sm border-b border-cyan-500/15 sticky top-0 z-20">
      <div className="max-w-2xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between">
        <h1 className="text-lg sm:text-xl font-bold text-cyan-300 cyber-glow flex items-center gap-1 sm:gap-2 font-mono">
          DAIMON
        </h1>
        <div className="flex items-center gap-1 sm:gap-3">
          {/* Navigation */}
          <div className="flex items-end gap-0.5">
            <button
              onClick={() => onPageChange("timeline")}
              className={`relative flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 transition-all text-xs sm:text-sm font-mono ${currentPage === "timeline"
                  ? "bg-[#2a2a50] text-cyan-300 rounded-t-lg -mb-[1px] z-10 border-t-2 border-l-2 border-r-2 border-cyan-500/40"
                  : "text-cyan-300/80 hover:text-cyan-300 bg-[#1f1f35] rounded-t-lg border-t border-l border-r border-cyan-500/15 hover:border-cyan-500/35"
                }`}
            >
              {/* Bookmark notch */}
              {currentPage === "timeline" && (
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-cyan-500/40"></div>
              )}
              <Home size={14} className="sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">HOME</span>
            </button>
            <button
              onClick={() => onPageChange("search")}
              className={`relative flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 transition-all text-xs sm:text-sm font-mono ${currentPage === "search"
                  ? "bg-[#2a2a50] text-cyan-300 rounded-t-lg -mb-[1px] z-10 border-t-2 border-l-2 border-r-2 border-cyan-500/40"
                  : "text-cyan-300/80 hover:text-cyan-300 bg-[#1f1f35] rounded-t-lg border-t border-l border-r border-cyan-500/15 hover:border-cyan-500/35"
                }`}
            >
              {currentPage === "search" && (
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-cyan-500/40"></div>
              )}
              <Search size={14} className="sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">SEARCH</span>
            </button>
          </div>
          <button
            onClick={onSettingsClick}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-[#1f1f35] border border-fuchsia-500/25 hover:border-fuchsia-500/40 rounded transition-all text-xs sm:text-sm text-fuchsia-300 hover:text-fuchsia-300 font-mono"
            title="Timeline Settings"
          >
            <Settings2 size={14} className="sm:w-4 sm:h-4" />
            <span className="hidden sm:inline font-medium">SENSE: </span>
            <span className="text-xs sm:text-sm font-medium">{Math.round(similarityWeight * 100)}%</span>
          </button>
          {user ? (
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={onProfileClick}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-[#1f1f35] border border-cyan-500/15 hover:border-cyan-500/35 rounded transition-all cursor-pointer font-mono"
                title="Edit Profile"
              >
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.username}
                    className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-cyan-500/18"
                  />
                ) : (
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br from-cyan-400/90 to-fuchsia-400/90 flex items-center justify-center text-black text-xs font-bold border border-cyan-500/18">
                    {user.username[0].toUpperCase()}
                  </div>
                )}
                <span className="hidden sm:inline text-sm font-medium text-cyan-300">{user.username}</span>
              </button>
              <button
                onClick={onLogout}
                className="p-1.5 sm:p-2 text-cyan-300/80 hover:text-red-300 hover:bg-red-900/15 border border-transparent hover:border-red-500/25 rounded transition-colors"
                title="Logout"
              >
                <LogOut size={16} className="sm:w-[18px] sm:h-[18px]" />
              </button>
            </div>
          ) : (
            <button
              onClick={onAuthClick}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-cyan-500/95 to-fuchsia-500/95 text-black rounded transition-all text-xs sm:text-sm font-mono font-bold hover:from-cyan-400 hover:to-fuchsia-400"
            >
              <UserIcon size={14} className="sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">LOGIN</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
