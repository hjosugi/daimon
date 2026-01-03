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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4"
      onClick={onClose}
    >
      <div 
        className="bg-[#0f0f1f] rounded-lg border border-cyan-500/18 w-full max-w-md mx-auto overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#2a2a50] border-b border-cyan-500/15 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-cyan-300 font-mono">
            {mode === "login" ? "LOGIN" : "SIGN UP"}
          </h2>
          <button
            onClick={onClose}
            className="text-cyan-300/90 hover:text-cyan-400 hover:bg-cyan-900/10 rounded p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-red-900/20 border border-red-500/30 rounded text-sm text-red-400/90 font-mono">
              [ERROR] {errorMessage}
            </div>
          )}
          {mode === "register" && (
            <>
              {/* Avatar Upload */}
              <div className="flex flex-col items-center gap-2">
                <label className="cursor-pointer">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-400/80 to-fuchsia-400/80 flex items-center justify-center overflow-hidden border-2 border-cyan-500/18">
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Avatar preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon size={32} className="text-black" />
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </label>
                <span className="text-xs text-cyan-300/80 font-mono">PROFILE PICTURE (OPTIONAL)</span>
              </div>

              {/* Username */}
              <div>
                <label className="block text-xs font-medium text-cyan-300/95 mb-1 font-mono">
                  USERNAME
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-300/70" size={18} />
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    required={mode === "register"}
                    className="w-full pl-10 pr-4 py-2 bg-[#2a2a50] border border-cyan-500/15 rounded focus:ring-1 focus:ring-cyan-500/30 focus:border-cyan-500/40 text-cyan-300 placeholder:text-cyan-300/80 font-mono transition-all"
                    placeholder="USERNAME"
                  />
                </div>
              </div>
            </>
          )}

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-cyan-300/95 mb-1 font-mono">
              {mode === "login" ? "EMAIL OR USERNAME" : "EMAIL"}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-300/70" size={18} />
              <input
                type={mode === "login" ? "text" : "email"}
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
                className="w-full pl-10 pr-4 py-2 bg-[#2a2a50] border border-cyan-500/15 rounded focus:ring-1 focus:ring-cyan-500/30 focus:border-cyan-500/40 text-cyan-300 placeholder:text-cyan-300/80 font-mono transition-all"
                placeholder={mode === "login" ? "EMAIL OR USERNAME" : "EMAIL@EXAMPLE.COM"}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-cyan-300/95 mb-1 font-mono">
              PASSWORD
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-300/70" size={18} />
              <input
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required
                className="w-full pl-10 pr-4 py-2 bg-[#2a2a50] border border-cyan-500/15 rounded focus:ring-1 focus:ring-cyan-500/30 focus:border-cyan-500/40 text-cyan-300 placeholder:text-cyan-300/80 font-mono transition-all"
                placeholder="PASSWORD"
              />
            </div>
          </div>

          {mode === "register" && (
            <div>
              <label className="block text-xs font-medium text-cyan-300/95 mb-1 font-mono">
                CONFIRM PASSWORD
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-300/70" size={18} />
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, confirmPassword: e.target.value })
                  }
                  required
                  className="w-full pl-10 pr-4 py-2 bg-[#2a2a50] border border-cyan-500/15 rounded focus:ring-1 focus:ring-cyan-500/30 focus:border-cyan-500/40 text-cyan-300 placeholder:text-cyan-300/80 font-mono transition-all"
                  placeholder="CONFIRM PASSWORD"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={registerMutation.isPending || loginMutation.isPending}
            className="w-full py-3 bg-gradient-to-r from-cyan-500/90 to-fuchsia-500/90 text-black rounded font-semibold hover:from-cyan-400 hover:to-fuchsia-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-mono font-bold"
          >
            {registerMutation.isPending || loginMutation.isPending
              ? "PROCESSING..."
              : mode === "login"
                ? "LOGIN"
                : "SIGN UP"}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login")
                setFormData({ username: "", email: "", password: "", confirmPassword: "" })
                setAvatarPreview(null)
              }}
              className="text-sm text-cyan-300/90 hover:text-cyan-400 font-medium font-mono"
            >
              {mode === "login"
                ? "DON'T HAVE AN ACCOUNT? SIGN UP"
                : "ALREADY HAVE AN ACCOUNT? LOG IN"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
