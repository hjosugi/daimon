import {
  Bookmark,
  FileText,
  Home,
  LogOut,
  Moon,
  Search,
  Settings2,
  Sun,
  User as UserIcon,
} from "lucide-react"
import type React from "react"
import type { User } from "../api/client"
import { useI18n } from "../i18n"
import { useTheme } from "../theme"
import type { Page } from "../types/navigation"

interface HeaderProps {
  user: User | null
  currentPage: Page
  onPageChange: (page: Page) => void
  onAuthClick: () => void
  onProfileClick: () => void
  onLogout: () => void
  onSettingsClick: () => void
  similarityWeight: number
}

interface NavItemProps {
  active: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
}

const NavItem = ({ active, icon, label, onClick }: NavItemProps) => (
  <button
    type="button"
    onClick={onClick}
    className="nav-tab"
    data-active={active}
    aria-label={label}
    aria-current={active ? "page" : undefined}
    title={label}
  >
    {icon}
    <span className="nav-tab-label">{label}</span>
  </button>
)

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
  const { t } = useI18n()
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="site-header">
      <div className="header-shell">
        <button
          type="button"
          className="brand-button"
          onClick={() => onPageChange("timeline")}
          aria-label={t("nav.home")}
          title={t("nav.home")}
        >
          <span className="brand-mark" aria-hidden="true">
            D
          </span>
          <span>DAIMON</span>
        </button>

        <nav className="primary-nav" aria-label={t("nav.primary")}>
          <NavItem
            active={currentPage === "timeline"}
            icon={<Home size={17} />}
            label={t("nav.home")}
            onClick={() => onPageChange("timeline")}
          />
          <NavItem
            active={currentPage === "search"}
            icon={<Search size={17} />}
            label={t("nav.search")}
            onClick={() => onPageChange("search")}
          />
          {user && (
            <NavItem
              active={currentPage === "mine"}
              icon={<FileText size={17} />}
              label={t("nav.mine")}
              onClick={() => onPageChange("mine")}
            />
          )}
          {user && (
            <NavItem
              active={currentPage === "saved"}
              icon={<Bookmark size={17} />}
              label={t("nav.saved")}
              onClick={() => onPageChange("saved")}
            />
          )}
        </nav>

        <div className="header-actions">
          <button
            type="button"
            onClick={onSettingsClick}
            className="header-action sense-action"
            aria-label={t("nav.timelineSettings")}
            title={t("nav.timelineSettings")}
          >
            <Settings2 size={17} />
            <span className="header-action-label">{t("nav.sense")}</span>
            <strong>{Math.round(similarityWeight * 100)}%</strong>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="icon-action"
            aria-label={
              theme === "dark"
                ? t("theme.switchToLight")
                : t("theme.switchToDark")
            }
            title={
              theme === "dark"
                ? t("theme.switchToLight")
                : t("theme.switchToDark")
            }
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {user ? (
            <div className="account-actions">
              <button
                type="button"
                onClick={onProfileClick}
                className="profile-pill"
                aria-label={t("nav.editProfile")}
                title={t("nav.editProfile")}
              >
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt=""
                    className="profile-avatar"
                  />
                ) : (
                  <span className="profile-avatar avatar-fallback">
                    {user.username[0].toUpperCase()}
                  </span>
                )}
                <span className="profile-name">{user.username}</span>
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="icon-action logout-action"
                title={t("nav.logout")}
                aria-label={t("nav.logout")}
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onAuthClick}
              className="login-button"
              aria-label={t("nav.login")}
              title={t("nav.login")}
            >
              <UserIcon size={17} />
              <span>{t("nav.login")}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
