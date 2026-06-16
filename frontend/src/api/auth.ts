import { apiErrorMessage } from "./errors"
import { api, clearAuthSession, setAuthSession } from "./http"
import type { LoginData, RegisterData, User } from "./types"

export const register = async (data: RegisterData): Promise<User> => {
  try {
    const response = await api
      .post("auth/register", { json: data })
      .json<User>()
    setAuthSession(response)
    return response
  } catch (error: unknown) {
    const message = await apiErrorMessage(error, "登録に失敗しました")
    if (message) throw new Error(message)
    throw error
  }
}

export const login = async (data: LoginData): Promise<User> => {
  try {
    const response = await api.post("auth/login", { json: data }).json<User>()
    setAuthSession(response)
    return response
  } catch (error: unknown) {
    const message = await apiErrorMessage(error, "ログインに失敗しました")
    if (message) throw new Error(message)
    throw error
  }
}

export const logout = () => {
  clearAuthSession()
}

export const getCurrentUser = async (): Promise<User> => {
  return await api.get("auth/me").json<User>()
}

export const updateProfile = async (data: {
  username?: string
  avatar_url?: string
  bio?: string
}): Promise<User> => {
  return await api.put("auth/profile", { json: data }).json<User>()
}

export const deleteAccount = async (): Promise<void> => {
  await api.delete("auth/account").json()
  clearAuthSession()
}
