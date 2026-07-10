import ky from "ky"
import { resolveAPIBaseURL } from "./baseUrl"

const API_BASE_URL = resolveAPIBaseURL(
  import.meta.env.VITE_API_BASE_URL,
  import.meta.env.PROD,
)

const AUTH_TOKEN_KEY = "auth_token"
const USER_ID_KEY = "user_id"
const LOCALE_KEY = "daimon_locale"

export const getAuthToken = () => localStorage.getItem(AUTH_TOKEN_KEY)

export const setAuthSession = (user: { id: string; token?: string }) => {
  if (!user.token) return
  localStorage.setItem(AUTH_TOKEN_KEY, user.token)
  localStorage.setItem(USER_ID_KEY, user.id)
}

export const clearAuthSession = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.removeItem(USER_ID_KEY)
}

const getPreferredLocale = () => {
  const stored = localStorage.getItem(LOCALE_KEY)
  if (stored === "ja" || stored === "en") return stored
  return navigator.language.toLowerCase().startsWith("en") ? "en" : "ja"
}

export const api = ky.create({
  prefixUrl: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  hooks: {
    beforeRequest: [
      (request) => {
        const token = getAuthToken()
        if (token) {
          request.headers.set("Authorization", `Bearer ${token}`)
        }
        request.headers.set("Accept-Language", getPreferredLocale())
        request.headers.set("X-Daimon-Locale", getPreferredLocale())
      },
    ],
  },
})
