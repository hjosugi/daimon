import ky from "ky"

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"

const AUTH_TOKEN_KEY = "auth_token"
const USER_ID_KEY = "user_id"

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
      },
    ],
  },
})
