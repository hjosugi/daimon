import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Mail, Save, Trash2, User as UserIcon } from "lucide-react"
import type React from "react"
import { useEffect, useState } from "react"
import { deleteAccount, type User, updateProfile } from "../api/client"
import { useI18n } from "../i18n"
import { readFileAsDataURL } from "../utils/file"
import { DeleteAccountDialog } from "./ProfileModal/DeleteAccountDialog"
import { AvatarPicker } from "./ui/AvatarPicker"
import { IconInput } from "./ui/IconInput"
import { ModalFrame } from "./ui/ModalFrame"

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (user: User) => void
  onDelete: () => void
  currentUser: User | null
}

const profileLabelClass =
  "block text-xs font-medium text-cyan-300/95 mb-2 font-mono"
const profileInputClass =
  "w-full pl-10 pr-4 py-2.5 bg-[#1f1f3a] border border-cyan-500/12 rounded focus:ring-1 focus:ring-cyan-500/30 focus:border-cyan-500/40 text-cyan-200/95 placeholder:text-cyan-500/30 font-mono transition-all"

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onDelete,
  currentUser,
}) => {
  const { t } = useI18n()
  const [username, setUsername] = useState("")
  const [bio, setBio] = useState("")
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const queryClient = useQueryClient()

  useEffect(() => {
    if (!currentUser || !isOpen) return
    setUsername(currentUser.username)
    setBio(currentUser.bio || "")
    setAvatarPreview(currentUser.avatar_url || null)
    setAvatarFile(null)
    setShowDeleteConfirm(false)
  }, [currentUser, isOpen])

  const updateProfileMutation = useMutation({
    mutationFn: (data: {
      username?: string
      avatar_url?: string
      bio?: string
    }) => updateProfile(data),
    onSuccess: (user) => {
      onSuccess(user)
      queryClient.invalidateQueries({ queryKey: ["user"] })
      onClose()
    },
  })

  const deleteAccountMutation = useMutation({
    mutationFn: () => deleteAccount(),
    onSuccess: () => {
      queryClient.clear()
      onDelete()
      onClose()
    },
  })

  const buildProfilePatch = async () => {
    const avatarChanged =
      avatarFile !== null || avatarPreview !== (currentUser?.avatar_url || null)

    return {
      username: username !== currentUser?.username ? username : undefined,
      avatar_url: avatarChanged
        ? avatarFile
          ? await readFileAsDataURL(avatarFile)
          : avatarPreview || ""
        : undefined,
      bio: bio !== (currentUser?.bio || "") ? bio : undefined,
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    updateProfileMutation.mutate(await buildProfilePatch())
  }

  const handleAvatarSelect = async (file: File) => {
    setAvatarFile(file)
    try {
      setAvatarPreview(await readFileAsDataURL(file))
    } catch (error) {
      console.error("Failed to read avatar", error)
    }
  }

  const handleRemoveAvatar = () => {
    setAvatarPreview(null)
    setAvatarFile(null)
  }

  if (!isOpen || !currentUser) return null

  return (
    <ModalFrame title={t("profile.edit")} onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        <AvatarPicker
          id="profile-avatar"
          preview={avatarPreview}
          previewAlt={t("common.avatarPreview")}
          fallback="user"
          size="lg"
          onFileSelect={handleAvatarSelect}
          onRemove={handleRemoveAvatar}
          removeLabel={t("profile.removeImage")}
          helpText={t("profile.changePicture")}
          showEditBadge
        />

        <IconInput
          id="profile-username"
          label={t("common.username")}
          icon={<UserIcon size={18} />}
          value={username}
          onChange={setUsername}
          required
          placeholder={t("common.username")}
          labelClassName={profileLabelClass}
          inputClassName={profileInputClass}
        />

        <div>
          <label htmlFor="profile-bio" className={profileLabelClass}>
            {t("common.bio")}
          </label>
          <textarea
            id="profile-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 160))}
            rows={3}
            maxLength={160}
            className="w-full px-3 py-2.5 bg-[#1f1f3a] border border-cyan-500/12 rounded focus:ring-1 focus:ring-cyan-500/30 focus:border-cyan-500/40 text-cyan-200/95 placeholder:text-cyan-500/30 font-mono transition-all resize-none"
            placeholder={t("auth.bioPlaceholder")}
          />
          <div className="mt-1 text-right text-[10px] text-cyan-300/60 font-mono">
            {bio.length}/160
          </div>
        </div>

        <IconInput
          id="profile-email"
          label={t("common.email")}
          icon={<Mail size={18} />}
          type="email"
          value={currentUser.email}
          disabled
          placeholder={t("auth.emailPlaceholder")}
          labelClassName={profileLabelClass}
          inputClassName="w-full pl-10 pr-4 py-2.5 bg-[#0f0f1f] border border-cyan-500/15 rounded text-cyan-300/70 cursor-not-allowed font-mono"
        />
        <p className="-mt-4 text-xs text-cyan-300/70 font-mono">
          {t("profile.emailCannotChange")}
        </p>

        <div className="pt-4 border-t border-cyan-500/15 space-y-3">
          <button
            type="submit"
            disabled={updateProfileMutation.isPending || !username.trim()}
            className="w-full py-3 bg-gradient-to-r from-cyan-500/90 to-fuchsia-500/90 text-black rounded font-semibold hover:from-cyan-400 hover:to-fuchsia-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 font-mono font-bold"
          >
            {updateProfileMutation.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <span>{t("common.saving")}</span>
              </>
            ) : (
              <>
                <Save size={18} />
                <span>{t("common.save")}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleteAccountMutation.isPending}
            className="w-full py-2.5 bg-red-900/20 text-red-400/90 rounded font-medium hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-red-500/30 hover:border-red-500/50 flex items-center justify-center gap-2 font-mono"
          >
            <Trash2 size={16} />
            <span>{t("profile.deleteAccount")}</span>
          </button>
        </div>
      </form>

      {showDeleteConfirm && (
        <DeleteAccountDialog
          isPending={deleteAccountMutation.isPending}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={() => deleteAccountMutation.mutate()}
        />
      )}
    </ModalFrame>
  )
}
