import { useState, useEffect } from "react"
import { X, User as UserIcon, Mail, Image as ImageIcon, Save, Trash2, AlertTriangle } from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { updateProfile, deleteAccount, type User } from "../api/client"

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (user: User) => void
  onDelete: () => void
  currentUser: User | null
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onDelete,
  currentUser,
}) => {
  const [username, setUsername] = useState<string>("")
  const [email, setEmail] = useState<string>("")
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const queryClient = useQueryClient()

  useEffect(() => {
    if (currentUser && isOpen) {
      setUsername(currentUser.username)
      setEmail(currentUser.email)
      setAvatarPreview(currentUser.avatar_url || null)
      setAvatarFile(null)
    }
  }, [currentUser, isOpen])

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { username?: string; avatar_url?: string }) => {
      return await updateProfile(data)
    },
    onSuccess: (user) => {
      onSuccess(user)
      queryClient.invalidateQueries({ queryKey: ["user"] })
      onClose()
    },
  })

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      return await deleteAccount()
    },
    onSuccess: () => {
      queryClient.clear()
      onDelete()
      onClose()
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (avatarFile) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result as string
        updateProfileMutation.mutate({
          username: username !== currentUser?.username ? username : undefined,
          avatar_url: base64String,
        })
      }
      reader.readAsDataURL(avatarFile)
    } else {
      updateProfileMutation.mutate({
        username: username !== currentUser?.username ? username : undefined,
        avatar_url: avatarPreview || undefined,
      })
    }
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAvatarFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveAvatar = () => {
    setAvatarPreview(null)
    setAvatarFile(null)
  }

  if (!isOpen || !currentUser) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4"
      onClick={onClose}
    >
      <div 
        className="bg-[#0f0f1f] rounded-lg border border-cyan-500/30 w-full max-w-md mx-auto overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#1a1a2f] border-b border-cyan-500/20 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-cyan-400/90 font-mono">EDIT PROFILE</h2>
          <button
            onClick={onClose}
            className="text-cyan-400/70 hover:text-cyan-400 hover:bg-cyan-900/10 rounded p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center gap-3">
            <label className="cursor-pointer">
              <div className="relative">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-cyan-400/80 to-fuchsia-400/80 flex items-center justify-center overflow-hidden border-2 border-cyan-500/30">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UserIcon size={40} className="text-black" />
                  )}
                </div>
                <div className="absolute bottom-0 right-0 bg-cyan-500/90 text-black rounded-full p-2 hover:bg-cyan-400 transition-colors border border-cyan-400/50">
                  <ImageIcon size={16} />
                </div>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="text-xs text-cyan-400/60 hover:text-cyan-400/80 px-3 py-1.5 bg-cyan-900/10 border border-cyan-500/20 rounded hover:bg-cyan-900/20 transition-colors font-mono"
              >
                REMOVE IMAGE
              </button>
            </div>
            <span className="text-xs text-cyan-400/50 text-center font-mono">
              CHANGE PROFILE PICTURE (OPTIONAL)
            </span>
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-medium text-cyan-400/80 mb-2 font-mono">
              USERNAME
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400/50" size={18} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2.5 bg-[#1a1a2f] border border-cyan-500/20 rounded focus:ring-1 focus:ring-cyan-500/30 focus:border-cyan-500/40 text-cyan-400/90 placeholder:text-cyan-500/30 font-mono transition-all"
                placeholder="> USERNAME"
              />
            </div>
          </div>

          {/* Email (Read-only) */}
          <div>
            <label className="block text-xs font-medium text-cyan-400/80 mb-2 font-mono">
              EMAIL
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400/50" size={18} />
              <input
                type="email"
                value={email}
                disabled
                className="w-full pl-10 pr-4 py-2.5 bg-[#0f0f1f] border border-cyan-500/15 rounded text-cyan-400/50 cursor-not-allowed font-mono"
                placeholder="EMAIL@EXAMPLE.COM"
              />
            </div>
            <p className="text-xs text-cyan-400/50 mt-1 font-mono">
              EMAIL CANNOT BE CHANGED
            </p>
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t border-cyan-500/15 space-y-3">
            <button
              type="submit"
              disabled={updateProfileMutation.isPending || !username.trim()}
              className="w-full py-3 bg-gradient-to-r from-cyan-500/90 to-fuchsia-500/90 text-black rounded font-semibold hover:from-cyan-400 hover:to-fuchsia-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 font-mono font-bold"
            >
              {updateProfileMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                  <span>SAVING...</span>
                </>
              ) : (
                <>
                  <Save size={18} />
                  <span>SAVE</span>
                </>
              )}
            </button>

            {/* Delete Account Button */}
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleteAccountMutation.isPending}
              className="w-full py-2.5 bg-red-900/20 text-red-400/90 rounded font-medium hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-red-500/30 hover:border-red-500/50 flex items-center justify-center gap-2 font-mono"
            >
              <Trash2 size={16} />
              <span>DELETE ACCOUNT</span>
            </button>
          </div>
        </form>

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-[#0f0f1f] rounded-lg border border-red-500/30 w-full max-w-md p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-900/30 border border-red-500/30 flex items-center justify-center">
                  <AlertTriangle className="text-red-400/90" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-red-400/90 font-mono">DELETE ACCOUNT</h3>
                  <p className="text-sm text-red-400/60 font-mono">THIS ACTION CANNOT BE UNDONE</p>
                </div>
              </div>
              <p className="text-sm text-cyan-300/80 font-mono">
                DELETING YOUR ACCOUNT WILL PERMANENTLY DELETE ALL YOUR POSTS, COMMENTS, AND LIKES.
                THIS ACTION CANNOT BE UNDONE.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleteAccountMutation.isPending}
                  className="flex-1 py-2.5 px-4 bg-[#1a1a2f] text-cyan-400/80 border border-cyan-500/20 rounded font-medium hover:bg-[#0f0f1f] hover:border-cyan-500/40 transition-colors disabled:opacity-50 font-mono"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={() => deleteAccountMutation.mutate()}
                  disabled={deleteAccountMutation.isPending}
                  className="flex-1 py-2.5 px-4 bg-red-600/90 text-white rounded font-medium hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-mono font-bold"
                >
                  {deleteAccountMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>DELETING...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      <span>DELETE</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
