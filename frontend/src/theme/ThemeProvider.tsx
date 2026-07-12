import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

export type Theme = "dark" | "light"

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const STORAGE_KEY = "daimon_theme"
const ThemeContext = createContext<ThemeContextValue | null>(null)

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === "light" ? "light" : "dark"
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    localStorage.setItem(STORAGE_KEY, theme)

    const themeColor = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    )
    themeColor?.setAttribute(
      "content",
      theme === "light" ? "#f4f7fb" : "#11131d",
    )
  }, [theme])

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((current) => (current === "dark" ? "light" : "dark"))
  }, [])

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) {
    throw new Error("useTheme must be used within ThemeProvider")
  }
  return value
}
