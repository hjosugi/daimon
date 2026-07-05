import { useMutation } from "@tanstack/react-query"
import { Lock, Mail, User as UserIcon } from "lucide-react"
import type React from "react"
import { useState } from "react"
import {
  type LoginData,
  login,
  type RegisterData,
  register,
  type User,
  updateProfile,
} from "../api/client"
import { localizedErrorMessage } from "../api/errors"
import { useI18n } from "../i18n"
import { PROFILE_CONSTRAINTS } from "../types/constants"
import { readFileAsDataURL } from "../utils/file"
import { AvatarPicker } from "./ui/AvatarPicker"
import { IconInput } from "./ui/IconInput"
import { ModalFrame } from "./ui/ModalFrame"

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (user: User) => void
}

const emptyAuthForm = {
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
  bio: "",
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { t } = useI18n()
  const [mode, setMode] = useState<"login" | "register">("login")
  const [formData, setFormData] = useState(emptyAuthForm)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [authErrorMessage, setAuthErrorMessage] = useState("")

  const resetForm = () => {
    setFormData(emptyAuthForm)
    setAvatarPreview(null)
    setAuthErrorMessage("")
  }

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      const user = await register(data)
      if (!avatarPreview) return user

      try {
        const updatedUser = await updateProfile({ avatar_url: avatarPreview })
        return { ...user, avatar_url: updatedUser.avatar_url }
      } catch (error) {
        console.error("Failed to upload avatar", error)
        return user
      }
    },
    onSuccess: (user) => {
      onSuccess(user)
      onClose()
      resetForm()
    },
    onError: (error: unknown) => {
      setAuthErrorMessage(
        localizedErrorMessage(error, t("auth.registrationFailed"), t),
      )
    },
  })

  const loginMutation = useMutation({
    mutationFn: (data: LoginData) => login(data),
    onSuccess: (user) => {
      onSuccess(user)
      onClose()
      resetForm()
    },
    onError: (error: unknown) => {
      setAuthErrorMessage(
        localizedErrorMessage(error, t("auth.loginFailed"), t),
      )
    },
  })

  const updateField = (field: keyof typeof emptyAuthForm, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === "register") {
      if (formData.password !== formData.confirmPassword) {
        setAuthErrorMessage(t("auth.passwordMismatch"))
        return
      }
      registerMutation.mutate({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        bio: formData.bio.trim() || undefined,
      })
      return
    }

    loginMutation.mutate({
      email_or_username: formData.email,
      password: formData.password,
    })
  }

  const handleAvatarSelect = async (file: File) => {
    try {
      setAvatarPreview(await readFileAsDataURL(file))
    } catch (error) {
      console.error("Failed to read avatar", error)
    }
  }

  const switchMode = () => {
    setMode((current) => (current === "login" ? "register" : "login"))
    resetForm()
  }

  if (!isOpen) return null

  const isPending = registerMutation.isPending || loginMutation.isPending

  return (
    <ModalFrame
      title={mode === "login" ? t("auth.login") : t("auth.signUp")}
      onClose={onClose}
      headerClassName="bg-[#2a2a50] border-cyan-500/15"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {authErrorMessage && (
          <div className="p-3 bg-red-900/20 border border-red-500/30 rounded text-sm text-red-400/90 font-mono">
            [{t("common.error")}] {authErrorMessage}
          </div>
        )}

        {mode === "register" && (
          <>
            <AvatarPicker
              id="auth-avatar"
              preview={avatarPreview}
              previewAlt={t("common.avatarPreview")}
              onFileSelect={handleAvatarSelect}
              helpText={t("auth.profilePictureOptional")}
            />

            <IconInput
              id="auth-username"
              label={t("common.username")}
              icon={<UserIcon size={18} />}
              value={formData.username}
              onChange={(value) => updateField("username", value)}
              required
              placeholder={t("common.username")}
            />

            <div>
              <label
                htmlFor="auth-bio"
                className="block text-xs font-medium text-cyan-300/95 mb-1 font-mono"
              >
                {t("common.bio")}
              </label>
              <textarea
                id="auth-bio"
                value={formData.bio}
                onChange={(e) =>
                  updateField(
                    "bio",
                    e.target.value.slice(0, PROFILE_CONSTRAINTS.BIO_MAX_LENGTH),
                  )
                }
                rows={3}
                maxLength={PROFILE_CONSTRAINTS.BIO_MAX_LENGTH}
                className="w-full px-3 py-2 bg-[#2a2a50] border border-cyan-500/15 rounded focus:ring-1 focus:ring-cyan-500/30 focus:border-cyan-500/40 text-cyan-300 placeholder:text-cyan-300/80 font-mono text-sm transition-all resize-none"
                placeholder={t("auth.bioPlaceholder")}
              />
              <div className="mt-1 text-right text-[10px] text-cyan-300/60 font-mono">
                {formData.bio.length}/{PROFILE_CONSTRAINTS.BIO_MAX_LENGTH}
              </div>
            </div>
          </>
        )}

        <IconInput
          id="auth-email"
          label={
            mode === "login" ? t("auth.emailOrUsername") : t("common.email")
          }
          icon={<Mail size={18} />}
          type={mode === "login" ? "text" : "email"}
          value={formData.email}
          onChange={(value) => updateField("email", value)}
          required
          placeholder={
            mode === "login"
              ? t("auth.emailOrUsername")
              : t("auth.emailPlaceholder")
          }
        />

        <IconInput
          id="auth-password"
          label={t("common.password")}
          icon={<Lock size={18} />}
          type="password"
          value={formData.password}
          onChange={(value) => updateField("password", value)}
          required
          placeholder={t("common.password")}
        />

        {mode === "register" && (
          <IconInput
            id="auth-confirm-password"
            label={t("auth.confirmPassword")}
            icon={<Lock size={18} />}
            type="password"
            value={formData.confirmPassword}
            onChange={(value) => updateField("confirmPassword", value)}
            required
            placeholder={t("auth.confirmPassword")}
          />
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-3 bg-gradient-to-r from-cyan-500/90 to-fuchsia-500/90 text-black rounded font-semibold hover:from-cyan-400 hover:to-fuchsia-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-mono font-bold"
        >
          {isPending
            ? t("common.processing")
            : mode === "login"
              ? t("auth.login")
              : t("auth.signUp")}
        </button>

        <div className="text-center">
          <button
            type="button"
            onClick={switchMode}
            className="text-sm text-cyan-300/90 hover:text-cyan-400 font-medium font-mono"
          >
            {mode === "login" ? t("auth.noAccount") : t("auth.hasAccount")}
          </button>
        </div>
      </form>
    </ModalFrame>
  )
}
