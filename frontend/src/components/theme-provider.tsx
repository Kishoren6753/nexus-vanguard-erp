import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

export type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
  children: React.ReactNode
  /**
   * Default theme if nothing is stored. For WM-8072 acceptance criteria this should
   * default to "light" behavior when storage is empty.
   */
  defaultTheme?: Theme
  /**
   * localStorage key used to persist theme selection.
   */
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  resolvedTheme: "dark" | "light"
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: "light",
  resolvedTheme: "light",
  setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

/**
 * Attempt to read the theme from localStorage. Returns null if:
 * - localStorage isn't available (SSR/privacy mode edge)
 * - the stored value isn't one of our supported themes
 */
function readStoredTheme(storageKey: string): Theme | null {
  try {
    const value = localStorage.getItem(storageKey)
    if (value === "light" || value === "dark" || value === "system") return value
    return null
  } catch {
    return null
  }
}

export function ThemeProvider({
  children,
  // WM-8072: default to light behavior when nothing is stored
  defaultTheme = "light",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    return readStoredTheme(storageKey) ?? defaultTheme
  })

  const getResolvedTheme = useCallback((t: Theme): "dark" | "light" => {
    if (t === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
    }
    return t
  }, [])

  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">(() =>
    getResolvedTheme(theme),
  )

  const applyTheme = useCallback((t: Theme) => {
    const root = window.document.documentElement

    // WM-8072: app theme is controlled through data-theme.
    const resolved = t === "system" ? getResolvedTheme("system") : t
    root.setAttribute("data-theme", resolved)
  }, [getResolvedTheme])

  // Keep DOM + resolvedTheme in sync with current theme.
  useEffect(() => {
    applyTheme(theme)
    setResolvedTheme(getResolvedTheme(theme))

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => {
      if (theme === "system") {
        applyTheme("system")
        setResolvedTheme(getResolvedTheme("system"))
      }
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [theme, applyTheme, getResolvedTheme])

  const setTheme = useCallback(
    (newTheme: Theme) => {
      // Persist selection for WM-8072.
      try {
        localStorage.setItem(storageKey, newTheme)
      } catch {
        // If storage is unavailable, we still allow changing theme for the session.
      }
      setThemeState(newTheme)
    },
    [storageKey],
  )

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  )

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}
