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
      queryClient.clear() // Clear all queries
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-md mx-auto overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Edit Profile</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center gap-3">
            <label className="cursor-pointer">
              <div className="relative">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UserIcon size={40} className="text-white" />
                  )}
                </div>
                <div className="absolute bottom-0 right-0 bg-blue-600 text-white rounded-full p-2 shadow-lg hover:bg-blue-700 transition-colors">
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
                className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Remove Image
              </button>
            </div>
            <span className="text-xs text-slate-500 text-center">
              Change profile picture (optional)
            </span>
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Username
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Username"
              />
            </div>
          </div>

          {/* Email (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="email"
                value={email}
                disabled
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
                placeholder="email@example.com"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Email cannot be changed
            </p>
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <button
              type="submit"
              disabled={updateProfileMutation.isPending || !username.trim()}
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              {updateProfileMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={18} />
                  <span>Save</span>
                </>
              )}
            </button>

            {/* Delete Account Button */}
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleteAccountMutation.isPending}
              className="w-full py-2.5 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-red-200 flex items-center justify-center gap-2"
            >
              <Trash2 size={16} />
              <span>Delete Account</span>
            </button>
          </div>
        </form>

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="text-red-600" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Delete Account</h3>
                  <p className="text-sm text-slate-600">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-sm text-slate-700">
                Deleting your account will permanently delete all your posts, comments, and likes.
                This action cannot be undone.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleteAccountMutation.isPending}
                  className="flex-1 py-2.5 px-4 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => deleteAccountMutation.mutate()}
                  disabled={deleteAccountMutation.isPending}
                  className="flex-1 py-2.5 px-4 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deleteAccountMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      <span>Delete</span>
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
