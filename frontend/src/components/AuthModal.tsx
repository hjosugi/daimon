import { useState } from "react"
import { X, User as UserIcon, Mail, Lock, Image as ImageIcon } from "lucide-react"
import { useMutation } from "@tanstack/react-query"
import { register, login, updateProfile, type RegisterData, type LoginData, type User } from "../api/client"

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (user: User) => void
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<"login" | "register">("login")
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>("")

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      const user = await register(data)
      // If avatar was selected, upload it
      if (avatarPreview) {
        try {
          // For MVP, we'll store as base64 in avatar_url
          // In production, upload to S3/Cloud Storage
          const updatedUser = await updateProfile({ avatar_url: avatarPreview })
          return { ...user, avatar_url: updatedUser.avatar_url }
        } catch (error) {
          console.error("Failed to upload avatar", error)
        }
      }
      return user
    },
    onSuccess: (user) => {
      onSuccess(user)
      onClose()
      setFormData({ username: "", email: "", password: "", confirmPassword: "" })
      setAvatarPreview(null)
      setErrorMessage("")
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail || error?.message || "Registration failed"
      setErrorMessage(message)
    },
  })

  const loginMutation = useMutation({
    mutationFn: (data: LoginData) => login(data),
    onSuccess: (user) => {
      onSuccess(user)
      onClose()
      setFormData({ username: "", email: "", password: "", confirmPassword: "" })
      setErrorMessage("")
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail || error?.message || "Login failed"
      setErrorMessage(message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === "register") {
      if (formData.password !== formData.confirmPassword) {
        alert("Passwords do not match")
        return
      }
      registerMutation.mutate({
        username: formData.username,
        email: formData.email,
        password: formData.password,
      })
    } else {
      loginMutation.mutate({
        email_or_username: formData.email,
        password: formData.password,
      })
    }
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-md mx-auto overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            {mode === "login" ? "Login" : "Sign Up"}
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {errorMessage}
            </div>
          )}
          {mode === "register" && (
            <>
              {/* Avatar Upload */}
              <div className="flex flex-col items-center gap-2">
                <label className="cursor-pointer">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Avatar preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon size={32} className="text-white" />
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </label>
                <span className="text-xs text-slate-500">Profile Picture (Optional)</span>
              </div>

              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Username
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    required={mode === "register"}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Username"
                  />
                </div>
              </div>
            </>
          )}

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {mode === "login" ? "Email or Username" : "Email"}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type={mode === "login" ? "text" : "email"}
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={mode === "login" ? "Email or Username" : "email@example.com"}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Password"
              />
            </div>
          </div>

          {mode === "register" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, confirmPassword: e.target.value })
                  }
                  required
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Confirm Password"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={registerMutation.isPending || loginMutation.isPending}
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
          >
            {registerMutation.isPending || loginMutation.isPending
              ? "Processing..."
              : mode === "login"
                ? "Login"
                : "Sign Up"}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login")
                setFormData({ username: "", email: "", password: "", confirmPassword: "" })
                setAvatarPreview(null)
              }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              {mode === "login"
                ? "Don't have an account? Sign up"
                : "Already have an account? Log in"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
